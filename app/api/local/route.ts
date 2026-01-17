import { type NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const scriptPath = path.join(process.cwd(), "scripts", "localapply.py");
  const accountsData = JSON.stringify(payload.accounts);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Launch Python
      const pythonProcess = spawn("python", [scriptPath, accountsData]);

      // Handle Standard Output (Direct prints)
      pythonProcess.stdout.on("data", (data) => {
        controller.enqueue(encoder.encode(data.toString()));
      });

      // Handle Standard Error (Logging & Crashes)
      pythonProcess.stderr.on("data", (data) => {
        const message = data.toString();
        
        // Check if the log actually contains error-level keywords
        if (message.toUpperCase().includes("ERROR") || message.toUpperCase().includes("CRITICAL")) {
          controller.enqueue(encoder.encode(`❌ ${message}`));
        } else {
          // It's just an INFO or WARNING log, send it clean
          controller.enqueue(encoder.encode(message));
        }
      });

      pythonProcess.on("close", (code) => {
        const finalMsg = code === 0 
          ? "\n✅ --- All Tasks Finished Successfully ---" 
          : `\n⚠️ --- Process exited with code ${code} ---`;
        
        controller.enqueue(encoder.encode(finalMsg));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}