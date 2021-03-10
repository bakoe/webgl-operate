
/* spellchecker: disable */

import { vec3 } from 'gl-matrix';

import {
    AccumulatePass,
    AntiAliasingKernel,
    BlitPass,
    Camera,
    Canvas,
    CuboidGeometry,
    Color,
    ColorScale,
    Context,
    DefaultFramebuffer,
    EventProvider,
    Framebuffer,
    Invalidate,
    Navigation,
    NdcFillingTriangle,
    Program,
    Renderbuffer,
    Renderer,
    Shader,
    Texture2D,
    Texture3D,
    Wizard,
} from 'webgl-operate';

import { Example } from './example';

/* spellchecker: enable */


// tslint:disable:max-classes-per-file

export class VolumeRenderer extends Renderer {

    protected _camera: Camera;
    protected _navigation: Navigation;

    protected _cuboid: CuboidGeometry;

    protected _ndcTriangle: NdcFillingTriangle;
    protected _ndcOffsetKernel: AntiAliasingKernel;

    protected _volumeTexture: Texture3D;
    protected _colorScaleTexture: Texture2D;

    protected _program: Program;
    protected _uViewProjection: WebGLUniformLocation;
    protected _uEyePosition: WebGLUniformLocation;
    protected _uVolumeScale: WebGLUniformLocation;
    protected _uDtScale: WebGLUniformLocation;
    protected _uNdcOffset: WebGLUniformLocation;

    protected _uVolumeDimensions: WebGLUniformLocation;

    protected _defaultFBO: DefaultFramebuffer;
    protected _colorRenderTexture: Texture2D;
    protected _depthRenderbuffer: Renderbuffer;
    protected _intermediateFBO: Framebuffer;

    protected _accumulate: AccumulatePass;
    protected _blit: BlitPass;


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
        const gl2facade = this._context.gl2facade;

        this._cuboid = new CuboidGeometry(context, 'Cuboid', true, [2.0, 2.0, 2.0]);
        this._cuboid.initialize();

        this._ndcTriangle = new NdcFillingTriangle(this._context);
        this._ndcTriangle.initialize();


        this._colorRenderTexture = new Texture2D(this._context, 'ColorRenderTexture');
        this._depthRenderbuffer = new Renderbuffer(this._context, 'DepthRenderbuffer');
        this._intermediateFBO = new Framebuffer(this._context, 'IntermediateFBO');


        const vert = new Shader(context, gl.VERTEX_SHADER, 'volume.vert');
        vert.initialize(require('./data/volume.vert'));
        const frag = new Shader(context, gl.FRAGMENT_SHADER, 'volume.frag');
        frag.initialize(require('./data/volume.frag'));


        this._program = new Program(context, 'VolumeProgram');
        this._program.initialize([vert, frag], false);

        this._program.attribute('a_vertex', this._cuboid.vertexLocation);
        this._program.link();
        this._program.bind();

        gl.uniform1i(this._program.uniform('u_volume'), 0); // TEXTURE0
        gl.uniform1i(this._program.uniform('u_transferFunction'), 1); // TEXTURE1

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uEyePosition = this._program.uniform('u_eyePosition');
        this._uVolumeScale = this._program.uniform('u_volumeScale');
        this._uDtScale = this._program.uniform('u_dtScale');
        this._uNdcOffset = this._program.uniform('u_ndcOffset');

        this._uVolumeDimensions = this._program.uniform('u_volumeDims');

        // TODO: Re-Add u_model and thus allow positioning the model in 3D space
        // const identity = mat4.identity(mat4.create());
        // gl.uniformMatrix4fv(this._program.uniform('u_model'), gl.FALSE, identity);

        this._volumeTexture = new Texture3D(context, 'Texture-Volume');
        this._volumeTexture.initialize(1, 1, 1, gl.R8, gl.RED, gl.UNSIGNED_BYTE);
        this._volumeTexture.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._volumeTexture.filter(gl.LINEAR, gl.LINEAR, gl.LINEAR);

        void this._volumeTexture.loadFromUint8Raw(
            '/examples/data/volume_fuel_64x64x64_uint8.raw',
            [64, 64, 64]
        ).then(() => {
            this.finishLoading();
            this.invalidate(true);
        });

        this._colorScaleTexture = new Texture2D(context, `Texture-ColorScale`);
        this._colorScaleTexture.initialize(8, 1, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
        this._colorScaleTexture.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._colorScaleTexture.filter(gl.LINEAR, gl.LINEAR);

        const invert = true;

        ColorScale.fromPreset(`data/colorbrewer.json`, 'RdYlBu', 8).then((scale: ColorScale) => {
            if (invert) {
                scale.invert();
            }
            const data = scale.bitsUI8(Color.Space.RGB, false);
            this._colorScaleTexture.data(data, true, false);
        });


        this._camera = new Camera();
        this._camera.center = vec3.fromValues(0.0, 0.0, 0.0);
        this._camera.up = vec3.fromValues(0.0, 1.0, 0.0);
        this._camera.eye = vec3.fromValues(0.0, 0.0, 2.0);
        this._camera.near = 0.1;
        this._camera.far = 10.0;


        this._navigation = new Navigation(callback, eventProvider);
        this._navigation.camera = this._camera;

        this._accumulate = new AccumulatePass(context);
        this._accumulate.initialize(this._ndcTriangle);
        this._accumulate.precision = this._framePrecision;
        this._accumulate.texture = this._colorRenderTexture;

        this._blit = new BlitPass(this._context);
        this._blit.initialize(this._ndcTriangle);
        this._blit.readBuffer = gl2facade.COLOR_ATTACHMENT0;
        this._blit.drawBuffer = gl.BACK;
        this._blit.target = this._defaultFBO;

        return true;
    }

    /**
     * Uninitializes buffers, geometry and program.
     */
    protected onUninitialize(): void {
        super.uninitialize();

        this._cuboid.uninitialize();
        this._ndcTriangle.uninitialize();
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
        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        if (!this._intermediateFBO.initialized) {
            this._colorRenderTexture.initialize(this._frameSize[0], this._frameSize[1],
                this._context.isWebGL2 ? gl.RGBA8 : gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
            this._depthRenderbuffer.initialize(this._frameSize[0], this._frameSize[1], gl.DEPTH_COMPONENT16);
            this._intermediateFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture]
                , [gl.DEPTH_ATTACHMENT, this._depthRenderbuffer]]);
            this._intermediateFBO.clearColor([1.0, 1.0, 1.0, 1.0]);
        }

        if (this._altered.frameSize) {
            this._intermediateFBO.resize(this._frameSize[0], this._frameSize[1]);
            this._camera.viewport = [this._frameSize[0], this._frameSize[1]];
        }

        if (this._altered.canvasSize) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
            this._camera.viewport = this._canvasSize;
        }

        if (this._altered.clearColor) {
            this._defaultFBO.clearColor(this._clearColor);
        }

        if (this._altered.multiFrameNumber) {
            this._ndcOffsetKernel = new AntiAliasingKernel(this._multiFrameNumber);
        }

        this._accumulate.update();

        this._altered.reset();
        this._camera.altered = false;
    }

    protected onFrame(frameNumber: number): void {
        if (this.isLoading) {
            return;
        }

        const gl = this._context.gl;

        this._intermediateFBO.bind();
        this._intermediateFBO.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);

        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);

        const ndcOffset = this._ndcOffsetKernel.get(frameNumber);
        ndcOffset[0] = 2.0 * ndcOffset[0] / this._frameSize[0];
        ndcOffset[1] = 2.0 * ndcOffset[1] / this._frameSize[1];


        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this._volumeTexture.bind(gl.TEXTURE0);
        this._colorScaleTexture.bind(gl.TEXTURE1);

        this._program.bind();
        gl.uniformMatrix4fv(this._uViewProjection, gl.GL_FALSE, this._camera.viewProjection);
        gl.uniform3fv(this._uEyePosition, this._camera.eye);
        // TODO: Replace hardcoded scale with cuboid’s scale(?)
        gl.uniform3fv(this._uVolumeScale, vec3.fromValues(2.0, 2.0, 2.0));

        gl.uniform3iv(this._uVolumeDimensions, [64, 64, 64]);
        gl.uniform2fv(this._uNdcOffset, ndcOffset);
        gl.uniform1f(this._uDtScale, 0.2);

        this._cuboid.bind();
        this._cuboid.draw();
        this._cuboid.unbind();

        this._program.unbind();

        this._volumeTexture.unbind(gl.TEXTURE0);

        // gl.cullFace(gl.FRONT);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        this._accumulate.frame(frameNumber);
    }

    protected onSwap(): void {
        this._blit.framebuffer = this._accumulate.framebuffer ?
            this._accumulate.framebuffer : this._intermediateFBO;
        try {
            this._blit.frame();
        } catch {
            // Do nothing
        }
    }

}


export class VolumeRenderingExample extends Example {

    private _canvas: Canvas;
    private _renderer: VolumeRenderer;

    onInitialize(element: HTMLCanvasElement | string): boolean {

        this._canvas = new Canvas(element, { antialias: false });
        this._canvas.controller.multiFrameNumber = 64;
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
