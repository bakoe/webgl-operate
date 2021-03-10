
precision lowp float;
/**
 * Taken from https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl
 */

@import ../../source/shaders/facade.frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

in vec3 v_viewRayDir;
flat in vec3 v_transformedEye;

void main(void)
{
    fragColor = vec4(normalize(v_viewRayDir), 1.0);
}
