precision lowp float;
precision lowp int;

@import ../../source/shaders/facade.vert;


#if __VERSION__ == 100
    attribute vec3 a_vertex;
    attribute vec2 a_uv;
#else
    in vec3 a_vertex;
    in vec2 a_uv;
#endif

uniform mat4 u_view;
uniform mat4 u_viewInverse;
uniform mat4 u_projection;

out vec2 v_uv;


void main()
{

    // vec4 p = vec4(a_vertex, 1.0);

    vec2 uv = a_uv * 2.0 - 1.0;
    uv *= 0.1;


    // approach I
    // vec3 u = vec3(u_viewInverse * vec4(1.0, 0.0, 0.0, 0.0)) * uv.x;
    // vec3 v = vec3(u_viewInverse * vec4(0.0, 1.0, 0.0, 0.0)) * uv.y;

    // approach II
    vec3 u = vec3(u_view[0][0], u_view[1][0], u_view[2][0]) * uv.x;
    vec3 v = vec3(u_view[0][1], u_view[1][1], u_view[2][1]) * uv.y;

    float size = 0.1;
    v_uv = a_uv;

    vec4 p = u_projection * u_view * vec4(a_vertex + u * size + v * size, 1.0);
	gl_Position = p; //vec4(p, 1.0);
}
