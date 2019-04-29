
import { assert } from '../auxiliaries';
import { GLfloat2, GLclampf4 } from '../tuples';

import { Camera } from '../camera';
import { ChangeLookup } from '../changelookup';
import { Context } from '../context';
import { Framebuffer } from '../framebuffer';
import { Initializable } from '../initializable';

import { SceneRenderPass } from './scenerenderpass';
import { SceneNode } from './scenenode';
import { mat4 } from 'gl-matrix';
import { GeometryComponent } from './geometrycomponent';
import { Program } from '../program';
import { TransformComponent } from './transformcomponent';


/**
 * @todo add description
 */
export class ForwardSceneRenderPass extends SceneRenderPass {

    /**
     * Alterable auxiliary object for tracking changes on render pass inputs and lazy updates.
     */
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: false,
        camera: false,
    });

    /** @see {@link target} */
    protected _target: Framebuffer;

    /** @see {@link camera} */
    protected _camera: Camera;

    /** @see {@link ndcOffset} */
    protected _ndcOffset: GLfloat2;

    /** @see {@link clearColor} */
    protected _clearColor: GLclampf4;

    /** @see {@link program} */
    protected _program: Program;

    updateModelTransform: (matrix: mat4) => void;
    updateViewProjectionTransform: (matrix: mat4) => void;

    /**
     * Creates a ...
     * @param context - @todo comment
     */
    constructor(context: Context) {
        super();
        this._context = context;

        /** @todo */
    }


    @Initializable.initialize()
    initialize(): boolean {
        // const gl = this._context.gl;

        /** @todo create shaders, programs, fbos, etc. - checkout label render pass for example */

        return true;
    }

    @Initializable.uninitialize()
    uninitialize(): void {

        /** @todo create shaders, programs, fbos, etc. - checkout label render pass for example */

    }


    /**
     * @todo comment
     */
    prepare(): void {

        /** @todo prepare for immediate (probably multiple) frame invocations (mostly useful in multi-frame sampling) */

    }


    /**
     * @param override - If enabled, everything will be updated, regardless of tracked alterations.
     */
    @Initializable.assert_initialized()
    update(override: boolean = false): void {
        // const gl = this._context.gl;

        /** @todo  checkout label render pass update for reference */

        // this._scene ... from SceneNodeRenderer ...

    }

    /**
     * @todo comment
     */
    @Initializable.assert_initialized()
    frame(): void {
        assert(this._target && this._target.valid, `valid target expected`);
        assert(this._program && this._program.valid, `valid program expected`);

        if (this._scene === undefined) {
            return;
        }

        const gl = this._context.gl;

        const size = this._target.size;
        gl.viewport(0, 0, size[0], size[1]);

        const c = this._clearColor;
        gl.clearColor(c[0], c[1], c[2], c[3]);

        this._target.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);

        this.renderNode(this._scene!, mat4.create());
    }

    renderNode(node: SceneNode, transform: mat4): void {
        assert(this.updateModelTransform !== undefined, `Model transform function needs to be initialized.`);
        assert(this.updateViewProjectionTransform !== undefined, `View Projection transform function needs to be initialized.`);

        const nodeTransform = mat4.clone(transform);

        const transformComponents = node.componentsOfType('TransformComponent');
        assert(transformComponents.length <= 1, `SceneNode can not have more than one transform component`);

        if (transformComponents.length === 1) {
            const transformComponent = transformComponents[0] as TransformComponent;
            mat4.mul(nodeTransform, nodeTransform, transformComponent.transform);
        }

        const geometryComponents = node.componentsOfType('GeometryComponent');

        this._program.bind();

        // TODO: allow different orders via visitor
        for (const geometryComponent of geometryComponents) {
            const currentComponent = geometryComponent as GeometryComponent;
            const material = currentComponent.material;
            const geometry = currentComponent.geometry;

            geometry.bind();
            material.bind();

            this.updateModelTransform(nodeTransform);
            this.updateViewProjectionTransform(this._camera.viewProjection);

            geometry.draw();

            material.unbind();
            geometry.unbind();
        }

        this._program.unbind();

        if (!node.nodes) {
            return;
        }

        for (const child of node.nodes) {
            this.renderNode(child, nodeTransform);
        }
    }


    /**
     * Sets the framebuffer the quads are rendered to.
     * @param target - Framebuffer to render into.
     */
    set target(target: Framebuffer) {
        this.assertInitialized();
        this._target = target;
    }

    /**
     * The NDC offset is used for vertex displacement within subpixel space for anti-aliasing over
     * multiple intermediate frames (multi-frame sampling).
     * @param offset - Subpixel offset used for vertex displacement (multi-frame anti-aliasing).
     */
    set ndcOffset(offset: GLfloat2) {
        this.assertInitialized();
        this._ndcOffset = offset;
    }

    /**
     * The camera's viewProjection is used for 3D label placement calculation.
     */
    set camera(camera: Camera) {
        this.assertInitialized();
        if (this._camera === camera) {
            return;
        }
        this._camera = camera;
        this._altered.alter('camera');
    }

    /**
     * Sets the clear color for rendering.
     */
    set clearColor(color: GLclampf4) {
        this._clearColor = color;
    }

    set program(program: Program) {
        this._program = program;
    }
}
