'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Movement } from '@/lib/studio';
type Props = {
  movement: Movement;
  playing: boolean;
  speed: number;
  cameraView: number;
  highlight: boolean;
};
export default function AthleteScene(props: Props) {
  const mount = useRef<HTMLDivElement>(null),
    live = useRef(props),
    [state, setState] = useState('loading');
  useEffect(() => {
    live.current = props;
  }, [props]);
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setState('fallback'));
      return;
    }
    let disposed = false;
    let actor: THREE.Group | null = null;
    const bones: Record<string, THREE.Bone> = {},
      bind: Record<string, THREE.Quaternion> = {},
      positions: Record<string, THREE.Vector3> = {};
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let userToggled = false;
    const initialPlay = live.current.playing;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 35);
    camera.position.set(0.9, 1.17, 4.8);
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, el.clientWidth < 500 ? 1.3 : 1.7),
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x0d1729, 0);
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.93, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = 0.65;
    controls.maxPolarAngle = 1.58;
    controls.rotateSpeed = 0.45;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.035);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.45;
    room.dispose();
    scene.add(new THREE.HemisphereLight(0xdbeeff, 0x142447, 1.15));
    const key = new THREE.SpotLight(0xe5edff, 42, 13, 0.47, 0.6, 1.3);
    key.position.set(-2.2, 4.8, 3.5);
    key.target.position.set(0, 0.9, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.02;
    scene.add(key, key.target);
    const rim = new THREE.SpotLight(0x78d6ff, 58, 12, 0.5, 0.7, 1.2);
    rim.position.set(2.4, 2.8, -2.3);
    rim.target.position.set(0, 0.85, 0);
    scene.add(rim, rim.target);
    const fill = new THREE.PointLight(0xb3a1ff, 9, 8, 1.5);
    fill.position.set(-2.7, 1.6, -0.8);
    scene.add(fill);
    const front = new THREE.PointLight(0xd1edff, 3, 6, 1.4);
    front.position.set(0, 1.8, 3);
    scene.add(front);
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b182c,
      metalness: 0.7,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
    });
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.35, 0.08, 128),
      floorMat,
    );
    platform.position.y = -0.055;
    platform.receiveShadow = true;
    scene.add(platform);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x9ed9ff,
      emissive: 0x509ddb,
      emissiveIntensity: 1.8,
      roughness: 0.3,
      metalness: 0.4,
    });
    function lightRing(radius: number, y: number) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.005, 8, 160),
        ringMat,
      );
      m.rotation.x = Math.PI / 2;
      m.position.y = y;
      scene.add(m);
    }
    lightRing(1.3, -0.013);
    lightRing(1.2, -0.012);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.505, 180),
      new THREE.MeshBasicMaterial({
        color: 0x527499,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.095;
    scene.add(halo);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.1;
    shadow.receiveShadow = true;
    scene.add(shadow);
    const metal = new THREE.MeshPhysicalMaterial({
      color: 0x8c9db1,
      metalness: 1,
      roughness: 0.23,
      clearcoat: 1,
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: 0x182434,
      metalness: 0.55,
      roughness: 0.36,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0x91d6f3,
      metalness: 0.75,
      roughness: 0.3,
      emissive: 0x1c4058,
      emissiveIntensity: 0.3,
    });
    function dumbbell() {
      const group = new THREE.Group();
      const cylinder = (
        r: number,
        h: number,
        mat: THREE.Material,
        x: number,
      ) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48), mat);
        m.rotation.z = Math.PI / 2;
        m.position.x = x;
        m.castShadow = true;
        group.add(m);
      };
      cylinder(0.022, 0.31, metal, 0);
      for (const side of [-1, 1]) {
        cylinder(0.102, 0.087, rubber, side * 0.145);
        cylinder(0.091, 0.017, metal, side * 0.198);
        cylinder(0.074, 0.005, accent, side * 0.208);
        cylinder(0.024, 0.009, metal, side * 0.213);
      }
      scene.add(group);
      group.visible = false;
      return group;
    }
    const leftWeight = dumbbell(),
      rightWeight = dumbbell();
    const particles = new THREE.BufferGeometry();
    const points = [];
    for (let i = 0; i < 38; i++) {
      const t = i * 2.399;
      points.push(
        Math.cos(t) * (1.2 + (i % 5) * 0.2),
        0.15 + (i % 17) * 0.13,
        Math.sin(t) * 1.2 - 0.4,
      );
    }
    particles.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    );
    const motes = new THREE.Points(
      particles,
      new THREE.PointsMaterial({
        color: 0xabcfff,
        size: 0.009,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    scene.add(motes);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.19, 0.45, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const clothingUniform = { value: 0 };
    new GLTFLoader().load(
      '/athlete.glb',
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        actor = gltf.scene;
        actor.traverse((o) => {
          if (o instanceof THREE.Bone) {
            bones[o.name] = o;
            bind[o.name] = o.quaternion.clone();
            positions[o.name] = o.position.clone();
          }
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material instanceof THREE.MeshStandardMaterial) {
              o.material.envMapIntensity = 0.65;
              o.material.roughness = 0.6;
              if (o.material.name === 'MI_Superhero_Male') {
                o.material.onBeforeCompile = (shader) => {
                  shader.uniforms.uFocus = clothingUniform;
                  shader.vertexShader =
                    'varying vec3 vRestPosition;\n' + shader.vertexShader;
                  shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    '#include <begin_vertex>\nvRestPosition = position;',
                  );
                  shader.fragmentShader =
                    'varying vec3 vRestPosition;\nuniform float uFocus;\n' +
                    shader.fragmentShader;
                  shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>
float py = vRestPosition.y; float ax = abs(vRestPosition.x);
float shirt = smoothstep(1.075,1.095,py)*(1.0-smoothstep(1.49,1.515,py));
shirt *= 1.0 - smoothstep(0.44,0.52,ax);
float neck = smoothstep(1.44,1.48,py)*(1.0-smoothstep(.075,.12,ax));
shirt *= 1.0-neck;
float shorts = smoothstep(.685,.7,py)*(1.0-smoothstep(1.10,1.115,py));
float cloth = max(shirt,shorts);
float weave = .015*sin(py*1700.0)*sin(vRestPosition.x*1700.0);
vec3 textile = mix(vec3(.018,.029,.045),vec3(.041,.064,.085),shirt)+weave;
float trim = smoothstep(.687,.694,py)*(1.0-smoothstep(.701,.71,py));
float shoulderStripe = smoothstep(.36,.38,ax)*(1.0-smoothstep(.40,.42,ax))*shirt;
textile = mix(textile,vec3(.23,.54,.67),max(trim,shoulderStripe)*.65);
diffuseColor.rgb = mix(diffuseColor.rgb,textile,cloth);
diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,1.05,1.19),uFocus*.5);
`,
                  );
                };
                o.material.customProgramCacheKey = () =>
                  'sculptai-athlete-clothing-v2';
              }
            }
          }
        });
        scene.add(actor);
        actor.updateMatrixWorld(true);
        setState('ready');
      },
      undefined,
      () => {
        if (!disposed) setState('fallback');
      },
    );
    const worldPoint = (name: string) =>
      bones[name]?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
    const xAxis = new THREE.Vector3(1, 0, 0),
      zAxis = new THREE.Vector3(0, 0, 1);
    function turn(name: string, axis: THREE.Vector3, angle: number) {
      const b = bones[name];
      if (b)
        b.quaternion
          .copy(bind[name])
          .multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
    }
    function aim(name: string, childName: string, direction: THREE.Vector3) {
      const b = bones[name],
        child = bones[childName];
      if (!b || !child) return;
      actor!.updateMatrixWorld(true);
      const w = b.getWorldQuaternion(new THREE.Quaternion());
      const current = child.position.clone().normalize().applyQuaternion(w);
      const target = new THREE.Quaternion()
        .setFromUnitVectors(current, direction.clone().normalize())
        .multiply(w);
      const parentQ = b
        .parent!.getWorldQuaternion(new THREE.Quaternion())
        .invert();
      b.quaternion.copy(parentQ.multiply(target));
    }
    function placeWeight(weight: THREE.Group, hand: string) {
      const bone = bones[hand];
      if (!bone) return;
      weight.visible = true;
      const side = hand.endsWith('_l') ? 'l' : 'r';
      const knuckle = bones['middle_01_' + side];
      bone.getWorldPosition(weight.position);
      if (knuckle)
        weight.position.lerp(
          knuckle.getWorldPosition(new THREE.Vector3()),
          0.78,
        );
      bone.getWorldQuaternion(weight.quaternion);
      weight.rotateY(Math.PI / 2);
    }
    function solveArm(
      side: 'l' | 'r',
      target: THREE.Vector3,
      bend: THREE.Vector3,
    ) {
      actor!.updateMatrixWorld(true);
      const shoulder = worldPoint('upperarm_' + side),
        elbow = worldPoint('lowerarm_' + side),
        wrist = worldPoint('hand_' + side);
      const l1 = shoulder.distanceTo(elbow),
        l2 = elbow.distanceTo(wrist),
        direction = target.clone().sub(shoulder),
        d = Math.min(direction.length(), l1 + l2 - 0.005),
        axis = direction.normalize();
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
        h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      const pole = bend
        .clone()
        .addScaledVector(axis, -bend.dot(axis))
        .normalize();
      const joint = shoulder
        .clone()
        .addScaledVector(axis, a)
        .addScaledVector(pole, h);
      aim('upperarm_' + side, 'lowerarm_' + side, joint.clone().sub(shoulder));
      aim('lowerarm_' + side, 'hand_' + side, target.clone().sub(joint));
    }
    let time = 0,
      prev = performance.now(),
      frame = 0,
      lastCamera = -1;
    let cameraTransition = false;
    const cameraDest = new THREE.Vector3();
    const views = [
      [0.85, 1.18, 4.8],
      [2.8, 1.55, 3.8],
      [4.6, 1.4, 0.6],
    ];
    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const now = performance.now(),
        dt = Math.min((now - prev) / 1000, 0.04);
      prev = now;
      const settings = live.current;
      if (settings.playing !== initialPlay) userToggled = true;
      const moving = settings.playing && (!reduced || userToggled);
      if (moving) time += dt * settings.speed;
      if (lastCamera !== settings.cameraView) {
        lastCamera = settings.cameraView;
        cameraDest.fromArray(views[lastCamera]);
        cameraTransition = true;
        controls.target.set(0, 0.93, 0);
      }
      if (cameraTransition) {
        camera.position.lerp(cameraDest, 1 - Math.exp(-dt * 5));
        if (camera.position.distanceTo(cameraDest) < 0.005)
          cameraTransition = false;
      }
      if (actor) {
        for (const [name, b] of Object.entries(bones)) {
          b.quaternion.copy(bind[name]);
          b.position.copy(positions[name]);
        }
        const phase = (1 - Math.cos(time * 1.45)) * 0.5;
        const breath = Math.sin(time * 1.1) * 0.008;
        if (settings.movement === 'curl') {
          turn('upperarm_l', zAxis, -1.38);
          turn('upperarm_r', zAxis, 1.38);
          turn('lowerarm_l', xAxis, 0.16 + phase * 1.8);
          turn(
            'lowerarm_r',
            xAxis,
            0.16 + (1 - Math.cos(time * 1.45 + 0.35)) * 0.5 * 1.8,
          );
          turn('spine_02', xAxis, breath);
        } else if (settings.movement === 'press') {
          turn('spine_02', xAxis, -0.015 + breath);
          solveArm(
            'l',
            new THREE.Vector3(0.39 - phase * 0.12, 1.57 + phase * 0.35, 0.055),
            new THREE.Vector3(1, -0.5, 0),
          );
          solveArm(
            'r',
            new THREE.Vector3(-0.39 + phase * 0.12, 1.57 + phase * 0.35, 0.055),
            new THREE.Vector3(-1, -0.5, 0),
          );
        } else {
          turn('upperarm_l', zAxis, -1.17);
          turn('upperarm_r', zAxis, 1.17);
          turn('lowerarm_l', xAxis, 1.7);
          turn('lowerarm_r', xAxis, 1.7);
          turn('spine_01', xAxis, 0.1 + phase * 0.12);
          actor.updateMatrixWorld(true);
          const feet = { l: worldPoint('foot_l'), r: worldPoint('foot_r') };
          const feetRotation = {
            l: bones.foot_l.getWorldQuaternion(new THREE.Quaternion()),
            r: bones.foot_r.getWorldQuaternion(new THREE.Quaternion()),
          };
          if (bones.pelvis) {
            const q = bones.pelvis
              .parent!.getWorldQuaternion(new THREE.Quaternion())
              .invert();
            bones.pelvis.position.add(
              new THREE.Vector3(0, -phase * 0.29, 0).applyQuaternion(q),
            );
          }
          actor.updateMatrixWorld(true);
          for (const side of ['l', 'r'] as const) {
            const hip = worldPoint('thigh_' + side),
              knee = worldPoint('calf_' + side),
              ankle = worldPoint('foot_' + side),
              target = feet[side];
            const l1 = hip.distanceTo(knee),
              l2 = knee.distanceTo(ankle);
            const delta = target.clone().sub(hip),
              dist = Math.min(delta.length(), l1 + l2 - 0.001),
              axis = delta.normalize();
            const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist),
              h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
            const bend = new THREE.Vector3(0, 0, 1)
              .addScaledVector(axis, -axis.z)
              .normalize();
            const joint = hip
              .clone()
              .addScaledVector(axis, a)
              .addScaledVector(bend, h);
            aim('thigh_' + side, 'calf_' + side, joint.clone().sub(hip));
            aim('calf_' + side, 'foot_' + side, target.clone().sub(joint));
            actor.updateMatrixWorld(true);
            bones['foot_' + side].quaternion.copy(
              bones['foot_' + side]
                .parent!.getWorldQuaternion(new THREE.Quaternion())
                .invert()
                .multiply(feetRotation[side]),
            );
          }
          const chest = worldPoint('spine_03');
          solveArm(
            'l',
            chest.clone().add(new THREE.Vector3(0.075, -0.05, 0.2)),
            new THREE.Vector3(0.8, -1, 0.3),
          );
          solveArm(
            'r',
            chest.clone().add(new THREE.Vector3(-0.075, -0.05, 0.2)),
            new THREE.Vector3(-0.8, -1, 0.3),
          );
        }
        for (const [name] of Object.entries(bones)) {
          if (/(index|middle|ring|pinky)_0[123]_/i.test(name))
            turn(name, zAxis, name.endsWith('_l') ? -0.9 : 0.9);
        }
        actor.updateMatrixWorld(true);
        placeWeight(leftWeight, 'hand_l');
        placeWeight(rightWeight, 'hand_r');
        if (settings.movement === 'squat') {
          rightWeight.visible = false;
          const midpoint = worldPoint('hand_l')
            .add(worldPoint('hand_r'))
            .multiplyScalar(0.5);
          leftWeight.position
            .copy(midpoint)
            .add(new THREE.Vector3(0, 0.02, 0.015));
          leftWeight.rotation.set(0, 0, Math.PI / 2);
        }
      }
      clothingUniform.value = THREE.MathUtils.damp(
        clothingUniform.value,
        settings.highlight ? 1 : 0,
        4,
        dt,
      );
      rim.intensity = THREE.MathUtils.damp(
        rim.intensity,
        settings.highlight ? 90 : 58,
        4,
        dt,
      );
      motes.rotation.y = time * 0.025;
      controls.update();
      composer.render();
    }
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    animate();
    const contextLost = (e: Event) => {
      e.preventDefault();
      setState('fallback');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      disposeObject(scene);
      environment.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={mount}
      className="athlete-canvas"
      role="img"
      aria-label="Animated three dimensional human athlete lifting dumbbells on a luminous training platform. Drag to rotate."
    >
      {state !== 'ready' && (
        <img
          className="model-fallback"
          src="/athlete-art.png"
          alt="Generated athlete portrait used while the 3D scene loads or when WebGL is unavailable"
        />
      )}
      {state === 'loading' && (
        <span className="model-status" role="status">
          Loading the human movement study…
        </span>
      )}
      {state === 'fallback' && (
        <span className="model-status">
          3D unavailable on this device · showing studio artwork
        </span>
      )}
    </div>
  );
}
function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) v.dispose();
        m.dispose();
      }
    }
  });
}
