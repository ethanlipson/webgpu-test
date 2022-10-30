import { useEffect, useRef } from "react";
import fragmentSrc from "../src/shaders/fragment";
import vertexSrc from "../src/shaders/vertex";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const entry: GPU = navigator.gpu;
      if (!entry) throw new Error("WebGPU not supported");

      const adapter: GPUAdapter | null = await entry.requestAdapter();
      if (!adapter) throw new Error("Adapter is null");

      const device: GPUDevice = await adapter.requestDevice();
      const queue = device.queue;

      const context = canvas.getContext("webgpu");
      if (!context) throw new Error("Context is null");
      context.configure({
        device,
        format: "bgra8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        alphaMode: "opaque",
      });

      // prettier-ignore
      const positions = new Float32Array([
        -1, -1, 0,
         0,  1, 0,
         1, -1, 0
      ]);

      // prettier-ignore
      const colors = new Float32Array([
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ]);

      const positionBuffer = device.createBuffer({
        size: positions.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
      });
      const positionsWriteArray = new Float32Array(
        positionBuffer.getMappedRange()
      );
      positionsWriteArray.set(positions);
      positionBuffer.unmap();

      const colorBuffer = device.createBuffer({
        size: colors.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
      });
      const colorsWriteArray = new Float32Array(colorBuffer.getMappedRange());
      colorsWriteArray.set(colors);
      colorBuffer.unmap();

      const vertModule = device.createShaderModule({ code: vertexSrc });
      const fragModule = device.createShaderModule({ code: fragmentSrc });

      const positionAttribDesc: GPUVertexAttribute = {
        shaderLocation: 0,
        offset: 0,
        format: "float32x3",
      };
      const positionBufferDesc: GPUVertexBufferLayout = {
        attributes: [positionAttribDesc],
        arrayStride: 4 * 3,
        stepMode: "vertex",
      };

      const colorAttribDesc: GPUVertexAttribute = {
        shaderLocation: 1,
        offset: 0,
        format: "float32x3",
      };
      const colorBufferDesc: GPUVertexBufferLayout = {
        attributes: [colorAttribDesc],
        arrayStride: 4 * 3,
        stepMode: "vertex",
      };

      const colorState: GPUColorTargetState = {
        format: "bgra8unorm",
      };

      const pipelineLayoutDesc = device.createPipelineLayout({
        bindGroupLayouts: [],
      });
      const pipeline = device.createRenderPipeline({
        layout: pipelineLayoutDesc,
        vertex: {
          module: vertModule,
          entryPoint: "main",
          buffers: [positionBufferDesc, colorBufferDesc],
        },
        fragment: {
          module: fragModule,
          entryPoint: "main",
          targets: [colorState],
        },
        primitive: {
          frontFace: "cw",
          cullMode: "none",
          topology: "triangle-list",
        },
      });

      const render = () => {
        const colorTexture = context.getCurrentTexture();
        const colorTextureView = colorTexture.createView();

        const colorAttachment: GPURenderPassColorAttachment = {
          view: colorTextureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        };

        const renderPassDesc: GPURenderPassDescriptor = {
          colorAttachments: [colorAttachment],
        };

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(pipeline);
        passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
        passEncoder.setScissorRect(0, 0, canvas.width, canvas.height);
        passEncoder.setVertexBuffer(0, positionBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.draw(3);
        passEncoder.end();

        queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
      };

      render();
    };

    run();
  }, []);

  return <canvas ref={canvasRef} />;
}
