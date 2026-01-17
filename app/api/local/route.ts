import { type NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import CryptoJS from "crypto-js";

export async function POST(request: NextRequest) {
  try {
    const { payload } = await request.json();
    const secretKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;

    if (!secretKey || !payload) {
      return new Response("Missing security parameters", { status: 401 });
    }

    // --- DECRYPTION ---
    const bytes = CryptoJS.AES.decrypt(payload, secretKey);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedData) {
      return new Response("Decryption Failed", { status: 403 });
    }

    const scriptPath = path.join(process.cwd(), "scripts", "localapply.py");
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const pythonProcess = spawn("python", [scriptPath, decryptedData]);

        pythonProcess.stdout.on("data", (data) => {
          controller.enqueue(encoder.encode(data.toString()));
        });

        pythonProcess.stderr.on("data", (data) => {
          controller.enqueue(encoder.encode(data.toString()));
        });

        pythonProcess.on("close", () => {
          controller.enqueue(encoder.encode(`\n--- FINISHED ---`));
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}