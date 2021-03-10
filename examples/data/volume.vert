
precision lowp float;
/**
 * Taken from https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl
 */

@import ../../source/shaders/facade.vert;

#if __VERSION__ == 100
    attribute vec3 a_vertex;
#else
    layout(location = 0) in vec3 a_vertex;
#endif

// TODO: Re-Add u_model and thus allow positioning the model in 3D space

uniform mat4 u_viewProjection;
uniform vec3 u_eyePosition;
uniform vec3 u_volumeScale;

out vec3 v_viewRayDir;
flat out vec3 v_transformedEye;

void main()
{
    // Translate the cube to center it at the origin.
	vec3 volumeTranslation = vec3(0.5) - u_volumeScale * 0.5;
	gl_Position = u_viewProjection * vec4(a_vertex * u_volumeScale + volumeTranslation, 1.0);

	// Compute eye position and ray directions in the unit cube space
	v_transformedEye = (u_eyePosition - volumeTranslation) / u_volumeScale;
	v_viewRayDir = a_vertex - v_transformedEye;
}
