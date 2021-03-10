
/* spellchecker: disable */

import { vec3 } from 'gl-matrix';

import {
    Camera,
    Canvas,
    CuboidGeometry,
    Context,
    DefaultFramebuffer,
    EventProvider,
    Invalidate,
    Navigation,
    Program,
    Renderer,
    Shader,
    Wizard,
} from 'webgl-operate';

import { Example } from './example';

/* spellchecker: enable */


// tslint:disable:max-classes-per-file

export class VolumeRenderer extends Renderer {

    protected _camera: Camera;
    protected _navigation: Navigation;

    protected _cuboid: CuboidGeometry;

    protected _program: Program;
    protected _uViewProjection: WebGLUniformLocation;
    protected _uEyePosition: WebGLUniformLocation;
    protected _uVolumeScale: WebGLUniformLocation;

    protected _defaultFBO: DefaultFramebuffer;


    /**
     * Initializes and sets up buffer, cube geometry, camera and links shaders with program.
     * @param context - valid context to create the object for.
     * @param identifier - meaningful name for identification of this instance.
     * @param mouseEventProvider - required for mouse interaction
     * @returns - whether initialization was successful
     */
    protected onInitialize(context: Context, callback: Invalidate,
        eventProvider: EventProvider): boolean {

        this._defaultFBO = new DefaultFramebuffer(context, 'DefaultFBO');
        this._defaultFBO.initialize();
        this._defaultFBO.bind();

        const gl = context.gl;

        this._cuboid = new CuboidGeometry(context, 'Cuboid', true, [1.0, 1.0, 1.0]);
        this._cuboid.initialize();


        const vert = new Shader(context, gl.VERTEX_SHADER, 'volume.vert');
        vert.initialize(require('./data/volume.vert'));
        const frag = new Shader(context, gl.FRAGMENT_SHADER, 'volume.frag');
        frag.initialize(require('./data/volume.frag'));


        this._program = new Program(context, 'VolumeProgram');
        this._program.initialize([vert, frag], false);

        this._program.attribute('a_vertex', this._cuboid.vertexLocation);
        this._program.link();
        this._program.bind();


        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uEyePosition = this._program.uniform('u_eyePosition');
        this._uVolumeScale = this._program.uniform('u_volumeScale');
        // const identity = mat4.identity(mat4.create());
        // gl.uniformMatrix4fv(this._program.uniform('u_model'), gl.FALSE, identity);
        // gl.uniform1i(this._program.uniform('u_texture'), 0);
        // gl.uniform1i(this._program.uniform('u_textured'), false);


        // this._texture = new Texture2D(context, 'Texture');
        // this._texture.initialize(1, 1, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
        // this._texture.wrap(gl.REPEAT, gl.REPEAT);
        // this._texture.filter(gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR);
        // this._texture.maxAnisotropy(Texture2D.MAX_ANISOTROPY);

        // this._texture.fetch('/examples/data/triangle-texture.webp').then(() => {
        //     const gl = context.gl;

        //     this._program.bind();
        //     gl.uniform1i(this._program.uniform('u_textured'), true);

        //     this.finishLoading();
        //     this.invalidate(true);
        // });

        this._camera = new Camera();
        this._camera.center = vec3.fromValues(0.0, 0.0, 0.0);
        this._camera.up = vec3.fromValues(0.0, 1.0, 0.0);
        this._camera.eye = vec3.fromValues(0.0, 0.0, 2.0);
        this._camera.near = 0.1;
        this._camera.far = 10.0;


        this._navigation = new Navigation(callback, eventProvider);
        this._navigation.camera = this._camera;

        this.finishLoading();

        return true;
    }

    /**
     * Uninitializes buffers, geometry and program.
     */
    protected onUninitialize(): void {
        super.uninitialize();

        this._cuboid.uninitialize();
        this._program.uninitialize();

        this._defaultFBO.uninitialize();
    }

    protected onDiscarded(): void {
        this._altered.alter('canvasSize');
        this._altered.alter('clearColor');
        this._altered.alter('frameSize');
        this._altered.alter('multiFrameNumber');
    }

    /**
     * This is invoked in order to check if rendering of a frame is required by means of implementation specific
     * evaluation (e.g., lazy non continuous rendering). Regardless of the return value a new frame (preparation,
     * frame, swap) might be invoked anyway, e.g., when update is forced or canvas or context properties have
     * changed or the renderer was invalidated @see{@link invalidate}.
     * @returns whether to redraw
     */
    protected onUpdate(): boolean {
        this._navigation.update();

        return this._altered.any || this._camera.altered;
    }

    /**
     * This is invoked in order to prepare rendering of one or more frames, regarding multi-frame rendering and
     * camera-updates.
     */
    protected onPrepare(): void {
        if (this._altered.canvasSize) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
            this._camera.viewport = this._canvasSize;
        }

        if (this._altered.clearColor) {
            this._defaultFBO.clearColor(this._clearColor);
        }

        this._altered.reset();
        this._camera.altered = false;
    }

    protected onFrame(): void {
        if (this.isLoading) {
            return;
        }

        const gl = this._context.gl;

        this._defaultFBO.bind();
        this._defaultFBO.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);

        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        gl.enable(gl.DEPTH_TEST);

        // this._texture.bind(gl.TEXTURE0);

        this._program.bind();
        gl.uniformMatrix4fv(this._uViewProjection, gl.GL_FALSE, this._camera.viewProjection);
        gl.uniform3fv(this._uEyePosition, this._camera.eye);
        // TODO: Replace hardcoded scale with cuboid’s scale(?)
        gl.uniform3fv(this._uVolumeScale, vec3.fromValues(1.0, 1.0, 1.0));

        this._cuboid.bind();
        this._cuboid.draw();
        this._cuboid.unbind();

        this._program.unbind();

        // this._texture.unbind(gl.TEXTURE0);

        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);
    }

    protected onSwap(): void { }

}


export class VolumeRenderingExample extends Example {

    private _canvas: Canvas;
    private _renderer: VolumeRenderer;

    onInitialize(element: HTMLCanvasElement | string): boolean {

        this._canvas = new Canvas(element, { antialias: false });
        this._canvas.controller.multiFrameNumber = 1;
        this._canvas.framePrecision = Wizard.Precision.byte;
        this._canvas.frameScale = [1.0, 1.0];

        this._renderer = new VolumeRenderer();
        this._canvas.renderer = this._renderer;

        return true;
    }

    onUninitialize(): void {
        this._canvas.dispose();
        (this._renderer as Renderer).uninitialize();
    }

    get canvas(): Canvas {
        return this._canvas;
    }

    get renderer(): VolumeRenderer {
        return this._renderer;
    }

}
