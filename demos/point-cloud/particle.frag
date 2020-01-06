
precision lowp float;
precision lowp int;

@import ../../source/shaders/facade.frag;


#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

uniform mat4 u_view;
uniform mat4 u_viewInverse;
uniform mat4 u_projection;



in vec2 v_uv;


void main()
{
//    fragColor = vec4(1.0, 0.0, 0.0, 1.0);

    float zz = 1.0 - dot(v_uv, v_uv);
    if(zz < 0.0)
        discard;

    float z = sqrt(zz);

    vec3 l = normalize(vec3(1.0, 1.0, 1.0));
    vec3 n = (u_viewInverse * vec4(vec3(v_uv.xy, z), 0.0)).xyz;

    float ldotn = dot(l, n);

    fragColor = vec4(v_uv.x * 0.5 + 0.5, v_uv.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 eye = mat3(u_viewInverse) * vec3(0.0, 0.0, 1.0);

    vec3 diffuse = vec3(1.0, 1.0, 1.0);
    float specular = pow(max(0.0, dot(eye, reflect(-l, n))), 128.0);
    vec3 ambient = vec3(0.05, 0.03, 0.07);


    fragColor = vec4(ambient + specular + ldotn * diffuse, 1.0);
}
