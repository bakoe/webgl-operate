
precision highp int;
precision highp float;
/**
 * Taken from https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl
 */

@import ../../source/shaders/facade.frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

uniform highp sampler3D u_volume;
// WebGL doesn't support 1D textures, so we use a 2D texture for the transfer function
uniform highp sampler2D u_transferFunction;
uniform ivec3 u_volumeDims;

uniform vec2 u_ndcOffset;

in vec3 v_viewRayDir;
flat in vec3 v_transformedEye;

vec2 intersect_box(vec3 orig, vec3 dir) {
	const vec3 box_min = vec3(0);
	const vec3 box_max = vec3(1);
	vec3 inv_dir = 1.0 / dir;
	vec3 tmin_tmp = (box_min - orig) * inv_dir;
	vec3 tmax_tmp = (box_max - orig) * inv_dir;
	vec3 tmin = min(tmin_tmp, tmax_tmp);
	vec3 tmax = max(tmin_tmp, tmax_tmp);
	float t0 = max(tmin.x, max(tmin.y, tmin.z));
	float t1 = min(tmax.x, min(tmax.y, tmax.z));
	return vec2(t0, t1);
}

// Pseudo-random number gen from
// http://www.reedbeta.com/blog/quick-and-easy-gpu-random-numbers-in-d3d11/
// with some tweaks for the range of values
float wang_hash(int seed) {
	seed = (seed ^ 61) ^ (seed >> 16);
	seed *= 9;
	seed = seed ^ (seed >> 4);
	seed *= 0x27d4eb2d;
	seed = seed ^ (seed >> 15);
	return float(seed % 2147483647) / float(2147483647);
}

void main(void)
{
    // Step 1: Normalize the view ray
	vec3 viewRayDirNormalized = normalize(v_viewRayDir);

    // Step 2: Intersect the ray with the volume bounds to find the interval
	// along the ray overlapped by the volume.
	vec2 t_hit = intersect_box(v_transformedEye, viewRayDirNormalized);
	if (t_hit.x > t_hit.y) {
		discard;
	}

    // We don't want to sample voxels behind the eye if it's
	// inside the volume, so keep the starting point at or in front
	// of the eye
	t_hit.x = max(t_hit.x, 0.0);

    // Step 3: Compute the step size to march through the volume grid
	vec3 dt_vec = 1.0 / (vec3(u_volumeDims) * abs(viewRayDirNormalized));
	float dt = min(dt_vec.x, min(dt_vec.y, dt_vec.z));

	float offset = wang_hash(int(
		gl_FragCoord.x
		+ 1e4 * gl_FragCoord.y
		+ 1e8 * u_ndcOffset.x
		+ 1e10 * u_ndcOffset.y
	));

    // Step 4: Starting from the entry point, march the ray through the volume
	// and sample it
	vec3 p = v_transformedEye + (t_hit.x + offset * dt) * viewRayDirNormalized;
	for (float t = t_hit.x; t < t_hit.y; t += dt) {
		// Step 4.1: Sample the volume, and color it by the transfer function.
		// Note that here we don't use the opacity from the transfer function,
		// and just use the sample value as the opacity
		float val = texture(u_volume, p).r;

        vec4 val_color = vec4(texture(u_transferFunction, vec2(val, 0.5)).rgb, val);

		// Step 4.2: Accumulate the color and opacity using the front-to-back
		// compositing equation
		fragColor.rgb += (1.0 - fragColor.a) * val_color.a * val_color.rgb;
		fragColor.a += (1.0 - fragColor.a) * val_color.a;

		// Optimization: break out of the loop when the color is near opaque
		if (fragColor.a >= 0.95) {
			break;
		}
		p += viewRayDirNormalized * dt;
	}
}
