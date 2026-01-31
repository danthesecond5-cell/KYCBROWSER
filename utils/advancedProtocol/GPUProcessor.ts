/**
 * GPU-Accelerated Video Processing Layer
 * 
 * Uses WebGL 2.0 and OffscreenCanvas for high-performance video frame
 * processing with zero-copy texture operations and shader-based effects.
 */

import {
  GPUProcessingConfig,
  GPUProcessingState,
  ShaderUniform,
  DEFAULT_GPU_CONFIG,
} from '@/types/advancedProtocol';

// ============================================================================
// SHADER PROGRAMS
// ============================================================================

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_PASSTHROUGH = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;

void main() {
  fragColor = texture(u_texture, v_texCoord);
}
`;

const FRAGMENT_SHADER_COLOR_CORRECTION = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform vec3 u_colorBalance;

vec3 adjustSaturation(vec3 color, float saturation) {
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luminance), color, saturation);
}

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  
  // Apply brightness
  color.rgb += u_brightness;
  
  // Apply contrast
  color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
  
  // Apply saturation
  color.rgb = adjustSaturation(color.rgb, u_saturation);
  
  // Apply color balance
  color.rgb *= u_colorBalance;
  
  // Clamp values
  fragColor = clamp(color, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_NOISE_INJECTION = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_noiseIntensity;
uniform float u_noiseSeed;

// Pseudo-random noise function
float random(vec2 st) {
  return fract(sin(dot(st.xy + u_noiseSeed, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  
  // Generate noise based on position and time
  float noise = (random(v_texCoord + u_time) - 0.5) * u_noiseIntensity;
  
  // Add noise to color
  color.rgb += noise;
  
  fragColor = clamp(color, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_FILM_GRAIN = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_grainAmount;
uniform float u_grainSize;

float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float grain(vec2 st) {
  vec2 ipos = floor(st * u_grainSize);
  return random(ipos + u_time);
}

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  
  float noise = grain(v_texCoord) * u_grainAmount;
  
  // Apply luminance-weighted grain (more visible in midtones)
  float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float grainWeight = 1.0 - abs(luminance - 0.5) * 2.0;
  
  color.rgb += (noise - 0.5) * grainWeight * 0.1;
  
  fragColor = clamp(color, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_VIGNETTE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_vignetteAmount;
uniform float u_vignetteRadius;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(v_texCoord, center);
  
  float vignette = smoothstep(u_vignetteRadius, u_vignetteRadius - 0.3, dist);
  vignette = mix(1.0, vignette, u_vignetteAmount);
  
  color.rgb *= vignette;
  
  fragColor = color;
}
`;

const FRAGMENT_SHADER_CHROMATIC_ABERRATION = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_aberrationAmount;

void main() {
  vec2 center = vec2(0.5, 0.5);
  vec2 dir = v_texCoord - center;
  
  float offset = u_aberrationAmount * length(dir);
  
  float r = texture(u_texture, v_texCoord + dir * offset).r;
  float g = texture(u_texture, v_texCoord).g;
  float b = texture(u_texture, v_texCoord - dir * offset).b;
  
  fragColor = vec4(r, g, b, 1.0);
}
`;

const FRAGMENT_SHADER_LENS_DISTORTION = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_distortionK1;
uniform float u_distortionK2;

void main() {
  vec2 center = vec2(0.5, 0.5);
  vec2 coord = v_texCoord - center;
  
  float r2 = dot(coord, coord);
  float distortion = 1.0 + u_distortionK1 * r2 + u_distortionK2 * r2 * r2;
  
  vec2 distortedCoord = center + coord * distortion;
  
  if (distortedCoord.x < 0.0 || distortedCoord.x > 1.0 ||
      distortedCoord.y < 0.0 || distortedCoord.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    fragColor = texture(u_texture, distortedCoord);
  }
}
`;

// Combined shader for efficiency
const FRAGMENT_SHADER_COMBINED = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_time;

// Color correction uniforms
uniform bool u_enableColorCorrection;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform vec3 u_colorBalance;

// Noise injection uniforms
uniform bool u_enableNoise;
uniform float u_noiseIntensity;
uniform float u_noiseSeed;

// Film grain uniforms
uniform bool u_enableFilmGrain;
uniform float u_grainAmount;

// Vignette uniforms
uniform bool u_enableVignette;
uniform float u_vignetteAmount;

float random(vec2 st) {
  return fract(sin(dot(st.xy + u_noiseSeed, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 adjustSaturation(vec3 color, float saturation) {
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luminance), color, saturation);
}

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  
  // Color correction
  if (u_enableColorCorrection) {
    color.rgb += u_brightness;
    color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
    color.rgb = adjustSaturation(color.rgb, u_saturation);
    color.rgb *= u_colorBalance;
  }
  
  // Noise injection
  if (u_enableNoise) {
    float noise = (random(v_texCoord + u_time) - 0.5) * u_noiseIntensity;
    color.rgb += noise;
  }
  
  // Film grain
  if (u_enableFilmGrain) {
    vec2 ipos = floor(v_texCoord * 100.0);
    float grain = random(ipos + u_time) * u_grainAmount;
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float grainWeight = 1.0 - abs(luminance - 0.5) * 2.0;
    color.rgb += (grain - 0.5) * grainWeight * 0.1;
  }
  
  // Vignette
  if (u_enableVignette) {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(v_texCoord, center);
    float vignette = smoothstep(0.7, 0.4, dist);
    vignette = mix(1.0, vignette, u_vignetteAmount);
    color.rgb *= vignette;
  }
  
  fragColor = clamp(color, 0.0, 1.0);
}
`;

// ============================================================================
// GPU PROCESSOR CLASS
// ============================================================================

export class GPUProcessor {
  private config: GPUProcessingConfig;
  private state: GPUProcessingState;
  
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private programs: Map<string, WebGLProgram> = new Map();
  private activeProgram: WebGLProgram | null = null;
  private texturePool: WebGLTexture[] = [];
  private framebuffers: WebGLFramebuffer[] = [];
  private vertexBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  
  private frameCount: number = 0;
  private processingTimes: number[] = [];
  private startTime: number = 0;
  private uniforms: Map<string, WebGLUniformLocation> = new Map();

  constructor(config: Partial<GPUProcessingConfig> = {}) {
    this.config = { ...DEFAULT_GPU_CONFIG, ...config };
    this.state = {
      backend: 'not_initialized',
      isInitialized: false,
      texturesAllocated: 0,
      vramUsageEstimate: 0,
      averageProcessingTimeMs: 0,
      framesProcessed: 0,
      shadersCompiled: 0,
    };
  }

  /**
   * Initialize the GPU processor
   */
  async initialize(width: number, height: number): Promise<void> {
    console.log('[GPUProcessor] Initializing...');
    
    this.startTime = performance.now();
    
    // Try to create OffscreenCanvas (preferred for performance)
    if (this.config.useOffscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
      try {
        this.canvas = new OffscreenCanvas(width, height);
        console.log('[GPUProcessor] Using OffscreenCanvas');
      } catch (e) {
        console.warn('[GPUProcessor] OffscreenCanvas failed, falling back to HTMLCanvasElement');
      }
    }
    
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
    }
    
    // Initialize WebGL context
    await this.initializeWebGL();
    
    // Set up geometry buffers
    this.setupGeometry();
    
    // Compile shaders
    await this.compileShaders();
    
    // Allocate texture pool
    this.allocateTexturePool();
    
    this.state.isInitialized = true;
    console.log('[GPUProcessor] Initialized with backend:', this.state.backend);
  }

  private async initializeWebGL(): Promise<void> {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    
    const contextOptions: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      desynchronized: true,
    };
    
    // Try WebGL 2 first
    if (this.config.preferredBackend === 'webgl2' || this.config.preferredBackend === 'webgl') {
      this.gl = this.canvas.getContext('webgl2', contextOptions) as WebGL2RenderingContext | null;
      if (this.gl) {
        this.state.backend = 'webgl2';
      }
    }
    
    // Fall back to WebGL 1
    if (!this.gl && this.config.preferredBackend !== 'software') {
      this.gl = this.canvas.getContext('webgl', contextOptions) as WebGLRenderingContext | null;
      if (this.gl) {
        this.state.backend = 'webgl';
      }
    }
    
    if (!this.gl) {
      this.state.backend = 'software';
      throw new Error('WebGL not available');
    }
    
    // Enable required extensions
    const gl = this.gl;
    if (this.state.backend === 'webgl') {
      gl.getExtension('OES_texture_float');
      gl.getExtension('OES_texture_float_linear');
    }
    
    // Set viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private setupGeometry(): void {
    if (!this.gl) return;
    const gl = this.gl;
    
    // Full-screen quad vertices
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    
    // Texture coordinates (flip Y for correct orientation)
    const texCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]);
    
    // Create vertex buffer
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Create texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  }

  private async compileShaders(): Promise<void> {
    if (!this.gl) return;
    
    // Compile combined shader (most efficient)
    const combinedProgram = this.compileProgram(
      VERTEX_SHADER_SOURCE,
      FRAGMENT_SHADER_COMBINED,
      'combined'
    );
    if (combinedProgram) {
      this.programs.set('combined', combinedProgram);
      this.activeProgram = combinedProgram;
    }
    
    // Compile passthrough shader for fallback
    const passthroughProgram = this.compileProgram(
      VERTEX_SHADER_SOURCE,
      FRAGMENT_SHADER_PASSTHROUGH,
      'passthrough'
    );
    if (passthroughProgram) {
      this.programs.set('passthrough', passthroughProgram);
    }
    
    // Compile individual effect shaders if needed
    if (this.config.shaders.chromaticAberration) {
      const caProgram = this.compileProgram(
        VERTEX_SHADER_SOURCE,
        FRAGMENT_SHADER_CHROMATIC_ABERRATION,
        'chromatic_aberration'
      );
      if (caProgram) {
        this.programs.set('chromatic_aberration', caProgram);
      }
    }
    
    if (this.config.shaders.lenDistortion) {
      const ldProgram = this.compileProgram(
        VERTEX_SHADER_SOURCE,
        FRAGMENT_SHADER_LENS_DISTORTION,
        'lens_distortion'
      );
      if (ldProgram) {
        this.programs.set('lens_distortion', ldProgram);
      }
    }
    
    console.log('[GPUProcessor] Compiled', this.programs.size, 'shader programs');
  }

  private compileProgram(
    vertexSource: string,
    fragmentSource: string,
    name: string
  ): WebGLProgram | null {
    if (!this.gl) return null;
    const gl = this.gl;
    
    // Downgrade shader version for WebGL 1
    let adjustedVertex = vertexSource;
    let adjustedFragment = fragmentSource;
    
    if (this.state.backend === 'webgl') {
      adjustedVertex = this.downgradeToWebGL1(vertexSource, 'vertex');
      adjustedFragment = this.downgradeToWebGL1(fragmentSource, 'fragment');
    }
    
    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) return null;
    
    gl.shaderSource(vertexShader, adjustedVertex);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error(`[GPUProcessor] Vertex shader compilation failed (${name}):`, 
        gl.getShaderInfoLog(vertexShader));
      gl.deleteShader(vertexShader);
      return null;
    }
    
    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      return null;
    }
    
    gl.shaderSource(fragmentShader, adjustedFragment);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(`[GPUProcessor] Fragment shader compilation failed (${name}):`, 
        gl.getShaderInfoLog(fragmentShader));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }
    
    // Create and link program
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`[GPUProcessor] Program linking failed (${name}):`, 
        gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }
    
    // Clean up shaders (they're linked to program now)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    this.state.shadersCompiled++;
    console.log(`[GPUProcessor] Compiled shader: ${name}`);
    
    return program;
  }

  private downgradeToWebGL1(source: string, type: 'vertex' | 'fragment'): string {
    let modified = source;
    
    // Remove version declaration
    modified = modified.replace('#version 300 es', '');
    
    // Replace in/out with varying/attribute
    if (type === 'vertex') {
      modified = modified.replace(/\bin\s+/g, 'attribute ');
      modified = modified.replace(/\bout\s+/g, 'varying ');
    } else {
      modified = modified.replace(/\bin\s+/g, 'varying ');
      modified = modified.replace(/\bout\s+vec4\s+fragColor;/g, '');
      modified = modified.replace(/fragColor\s*=/g, 'gl_FragColor =');
    }
    
    // Replace texture() with texture2D()
    modified = modified.replace(/texture\(/g, 'texture2D(');
    
    return modified;
  }

  private allocateTexturePool(): void {
    if (!this.gl) return;
    const gl = this.gl;
    
    for (let i = 0; i < this.config.texturePoolSize; i++) {
      const texture = gl.createTexture();
      if (texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        this.texturePool.push(texture);
        this.state.texturesAllocated++;
      }
    }
    
    // Estimate VRAM usage (approximate)
    if (this.canvas) {
      const bytesPerPixel = 4; // RGBA
      const textureSize = this.canvas.width * this.canvas.height * bytesPerPixel;
      this.state.vramUsageEstimate = (this.state.texturesAllocated * textureSize) / (1024 * 1024);
    }
    
    console.log('[GPUProcessor] Allocated', this.texturePool.length, 'textures');
  }

  /**
   * Process a video frame
   */
  processFrame(source: TexImageSource): ImageData | null {
    if (!this.gl || !this.canvas || !this.activeProgram) {
      return null;
    }
    
    const startTime = performance.now();
    const gl = this.gl;
    
    // Use program
    gl.useProgram(this.activeProgram);
    
    // Upload source texture
    const texture = this.texturePool[this.frameCount % this.texturePool.length];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    
    // Set uniforms
    this.setUniforms();
    
    // Bind vertex buffer
    const positionLoc = gl.getAttribLocation(this.activeProgram, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    
    // Bind texture coordinate buffer
    const texCoordLoc = gl.getAttribLocation(this.activeProgram, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
    
    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // Track metrics
    this.frameCount++;
    this.state.framesProcessed++;
    
    const processingTime = performance.now() - startTime;
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 60) {
      this.processingTimes.shift();
    }
    this.state.averageProcessingTimeMs = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    
    // Read back pixels if needed (expensive!)
    // For better performance, use getCanvas() instead
    return null;
  }

  private setUniforms(): void {
    if (!this.gl || !this.activeProgram) return;
    const gl = this.gl;
    
    const time = (performance.now() - this.startTime) / 1000;
    
    // Texture sampler
    this.setUniform('u_texture', 0);
    this.setUniform('u_time', time);
    
    // Color correction
    this.setUniform('u_enableColorCorrection', this.config.shaders.colorCorrection ? 1 : 0);
    this.setUniform('u_brightness', 0.0);
    this.setUniform('u_contrast', 1.0);
    this.setUniform('u_saturation', 1.0);
    this.setUniform3f('u_colorBalance', 1.0, 1.0, 1.0);
    
    // Noise injection
    this.setUniform('u_enableNoise', this.config.shaders.noiseInjection ? 1 : 0);
    this.setUniform('u_noiseIntensity', 0.02);
    this.setUniform('u_noiseSeed', Math.random() * 1000);
    
    // Film grain
    this.setUniform('u_enableFilmGrain', this.config.shaders.filmGrain ? 1 : 0);
    this.setUniform('u_grainAmount', 0.1);
    
    // Vignette
    this.setUniform('u_enableVignette', this.config.shaders.vignetteEffect ? 1 : 0);
    this.setUniform('u_vignetteAmount', 0.3);
  }

  private setUniform(name: string, value: number): void {
    if (!this.gl || !this.activeProgram) return;
    
    let location = this.uniforms.get(name);
    if (!location) {
      location = this.gl.getUniformLocation(this.activeProgram, name);
      if (location) {
        this.uniforms.set(name, location);
      }
    }
    
    if (location) {
      if (Number.isInteger(value)) {
        this.gl.uniform1i(location, value);
      } else {
        this.gl.uniform1f(location, value);
      }
    }
  }

  private setUniform3f(name: string, x: number, y: number, z: number): void {
    if (!this.gl || !this.activeProgram) return;
    
    let location = this.uniforms.get(name);
    if (!location) {
      location = this.gl.getUniformLocation(this.activeProgram, name);
      if (location) {
        this.uniforms.set(name, location);
      }
    }
    
    if (location) {
      this.gl.uniform3f(location, x, y, z);
    }
  }

  /**
   * Get the output canvas for streaming
   */
  getCanvas(): OffscreenCanvas | HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Create a MediaStream from the GPU output
   */
  captureStream(fps: number = 30): MediaStream | null {
    if (!this.canvas) return null;
    
    if (this.canvas instanceof HTMLCanvasElement) {
      return this.canvas.captureStream(fps);
    }
    
    // OffscreenCanvas doesn't support captureStream directly
    // Need to transfer to regular canvas
    return null;
  }

  /**
   * Resize the processor
   */
  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    
    console.log('[GPUProcessor] Resized to:', width, 'x', height);
  }

  /**
   * Get current state
   */
  getState(): GPUProcessingState {
    return { ...this.state };
  }

  /**
   * Update shader configuration
   */
  updateShaderConfig(shaders: Partial<GPUProcessingConfig['shaders']>): void {
    this.config.shaders = { ...this.config.shaders, ...shaders };
  }

  /**
   * Set quality preset
   */
  setQualityPreset(preset: GPUProcessingConfig['qualityPreset']): void {
    this.config.qualityPreset = preset;
    
    // Adjust settings based on preset
    switch (preset) {
      case 'ultra':
        this.config.shaders.filmGrain = true;
        this.config.shaders.chromaticAberration = true;
        this.config.shaders.vignetteEffect = true;
        break;
      case 'high':
        this.config.shaders.filmGrain = false;
        this.config.shaders.chromaticAberration = false;
        this.config.shaders.vignetteEffect = true;
        break;
      case 'medium':
        this.config.shaders.filmGrain = false;
        this.config.shaders.chromaticAberration = false;
        this.config.shaders.vignetteEffect = false;
        break;
      case 'low':
      case 'potato':
        this.config.shaders.colorCorrection = false;
        this.config.shaders.noiseInjection = false;
        this.config.shaders.filmGrain = false;
        this.config.shaders.chromaticAberration = false;
        this.config.shaders.vignetteEffect = false;
        break;
    }
    
    console.log('[GPUProcessor] Quality preset set to:', preset);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.gl) {
      // Delete textures
      for (const texture of this.texturePool) {
        this.gl.deleteTexture(texture);
      }
      
      // Delete framebuffers
      for (const fb of this.framebuffers) {
        this.gl.deleteFramebuffer(fb);
      }
      
      // Delete buffers
      if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
      }
      if (this.texCoordBuffer) {
        this.gl.deleteBuffer(this.texCoordBuffer);
      }
      
      // Delete programs
      for (const program of this.programs.values()) {
        this.gl.deleteProgram(program);
      }
    }
    
    this.texturePool = [];
    this.framebuffers = [];
    this.programs.clear();
    this.uniforms.clear();
    this.state.isInitialized = false;
    
    console.log('[GPUProcessor] Destroyed');
  }
}
