import { type NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const accounts = body.accounts; 
    
    const scriptPath = path.join(process.cwd(), "scripts", "localapply.py");
    const accountsData = JSON.stringify(accounts);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Run Python script
        const pythonProcess = spawn("python", [scriptPath, accountsData]);

        pythonProcess.stdout.on("data", (data) => {
          controller.enqueue(encoder.encode(data.toString()));
        });

        pythonProcess.stderr.on("data", (data) => {
          controller.enqueue(encoder.encode(data.toString()));
        });

        pythonProcess.on("close", (code) => {
          // This specific string triggers the "Finished" state in frontend
          controller.enqueue(encoder.encode(`\n--- FINISHED ---`));
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
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}