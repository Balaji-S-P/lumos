// orchestrator/planner.js
// Builds a plan (array of steps). Each step is { name: "summarize"|"rewrite"|"translate"|..., args: { ... } }
import {
  rewrite,
  summarize,
  prompt,
  languageDetector,
  translate,
  ensureTranslatorReady,
} from "./tools.js";
// Stack event emitter for function calls
async function emitStackEvent(eventType, data) {
  try {
    await chrome.storage.local.set({
      lumosStackEvent: {
        type: eventType,
        data: data,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.warn("Could not emit stack event:", error);
  }
}

export async function planExecution(userInstruction, selectedText) {
  const PLANNER_SYSTEM = `
You are a planner that creates execution plans for text processing tasks.

AVAILABLE FUNCTIONS:
1. summarize - Summarizes text
   args: { text: string, sharedContext: string }
2. rewrite - Rewrites text in different tone/style  
   args: { text: string, tone: string, context: string }
   tone: "more-formal", "more-casual", or "as-is"
3. prompt - Processes audio transcription or asks questions
   For audio: use question "What does this audio say?"
   args: { question: string }
4. languageDetector - Detects text language
   args: { text: string }
5. translate - Translates text
   args: { text: string, sourceLanguage: string, targetLanguage: string }

RULES:
- Only do what the user explicitly asks for
- Don't add extra steps unless requested
- For "transcribe audio" → use prompt function only
- For "transcribe and translate" → use prompt then translate
- Use languageDetector if you don't know the source language

OUTPUT FORMAT:
{"steps": [{"name": "function_name", "args": {...}}], "continueFlag": true}
OR
{"finalResponse": "result text", "continueFlag": false}

VERY IMPORTANT - continueFlag rules:
- If your response includes "steps" array → ALWAYS set "continueFlag": true
- ONLY set "continueFlag": false when you have NO "steps" and are providing "finalResponse"
- NEVER set "continueFlag": false when calling a function (when you have "steps")

EXAMPLES:
User: "summarize this" → {"steps": [{"name": "summarize", "args": {"text": "...", "sharedContext": "..."}}], "continueFlag": true}
User: "transcribe audio" → {"steps": [{"name": "prompt", "args": {"question": "What does this audio say?"}}], "continueFlag": true}
User: "translate to Spanish" → {"steps": [{"name": "translate", "args": {"text": "...", "sourceLanguage": "en", "targetLanguage": "es"}}], "continueFlag": true}

When you see "Function [name] result: [result]", provide the final response:
{"finalResponse": "[result]", "continueFlag": false}

When chaining operations (user says "and" or "then"):
- Look for keywords: "and", "then", "as", "also", "finally"
- If user requests multiple actions → do BOTH/MULTIPLE steps
- Each step uses the RESULT from the previous step as input


MULTI-STEP EXAMPLE:
User: "rewrite this in simple form and translate to Spanish"
Step 1: {"steps":[{"name":"rewrite","args":{"text":"...","tone":"more-casual","context":"..."}}],"continueFlag":true}
When you see "Function rewrite result: [result]", then:
Step 2: {"steps":[{"name":"translate","args":{"text":"[use the previous result]","sourceLanguage":"en","targetLanguage":"es"}}],"continueFlag":true}
When you see "Function translate result: [result]", then:
Final: {"finalResponse":"[result]","continueFlag":false}
`;
  let contents = [];

  // Emit planning start event
  await emitStackEvent("planningStart", {
    instruction: userInstruction,
    selectedText: selectedText,
  });

  const promptText = `${PLANNER_SYSTEM}\nUser instruction: ${userInstruction}\nSelected text: ${selectedText}\n\nRespond:`;
  contents.push({ role: "user", content: promptText });
  let continueFlag = true;
  let iteration = 0;
  let finalResponse = "";
  while (continueFlag) {
    iteration++;
    if (iteration > 1) {
      for (let i = 1; i < contents.length; i++) {}
    }
    try {
      const session = await LanguageModel.create({
        expectedInputs: [
          {
            type: "text",
            languages: ["en" /* system prompt */, "ja" /* user prompt */],
          },
        ],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      });
      const response = await session.prompt(contents);
      if (!response) {
        throw new Error("Failed to get response from AI");
      }
      contents.push({ role: "assistant", content: response });

      // Parse JSON, handling markdown code blocks
      let json;
      try {
        json = JSON.parse(response);
        if (
          json?.steps &&
          Array.isArray(json.steps) &&
          json.steps.length === 0
        ) {
          delete json.steps;
        }
        if (json?.finalResponse) {
          finalResponse = json?.finalResponse;
        }
      } catch (err) {
        console.log(
          "Direct JSON parse failed, trying to extract from markdown..."
        );

        // Try multiple extraction methods
        let jsonText = null;

        // Method 1: Standard markdown code block
        const jsonMatch1 = response.match(
          /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
        );
        if (jsonMatch1) {
          jsonText = jsonMatch1[1];
        }

        // Method 2: Alternative markdown pattern
        if (!jsonText) {
          const jsonMatch2 = response.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch2) {
            jsonText = jsonMatch2[1];
          }
        }

        // Method 3: Find any JSON object
        if (!jsonText) {
          const jsonMatch3 = response.match(/\{[\s\S]*\}/);
          if (jsonMatch3) {
            jsonText = jsonMatch3[0];
          }
        }

        if (jsonText) {
          try {
            json = JSON.parse(jsonText);
            if (
              json?.steps &&
              Array.isArray(json.steps) &&
              json.steps.length === 0
            ) {
              delete json.steps;
            }
            if (json?.continueFlag) {
              finalResponse = jsonText;
            }
          } catch (e) {
            throw new Error("Could not parse JSON from response: " + response);
          }
        } else {
          throw new Error("No JSON found in response: " + response);
        }
      }
      // Execute all steps and collect results
      const stepResults = [];
      for (const step of json?.steps || []) {
        if (!step.name) {
          contents.push({ role: "user", content: "Error: Missing step name" });
          break;
        }
        if (step.name === "summarize") {
          if (!step.args?.text || !step.args?.sharedContext) {
            contents.push({
              role: "user",
              content: "Error: Missing required arguments for summarize",
            });
            break;
          }
          // Emit stack event for function start
          await emitStackEvent("functionStart", {
            functionName: step.name,
            args: step.args,
          });

          const result = await summarize(
            step.args?.text,
            step.args?.sharedContext
          );

          // Emit stack event for function completion
          await emitStackEvent("functionComplete", {
            functionName: step.name,
            result: result,
          });

          stepResults.push({ step: step.name, result });
          contents.push({
            role: "user",
            content: `Function ${step.name} result: ${result}`,
          });
        } else if (step.name === "rewrite") {
          if (!step.args?.text || !step.args?.tone || !step.args?.context) {
            contents.push({
              role: "user",
              content: "Error: Missing required arguments for rewrite",
            });
            break;
          }
          // Emit stack event for function start
          await emitStackEvent("functionStart", {
            functionName: step.name,
            args: step.args,
          });

          const result = await rewrite(
            step.args?.text,
            step.args?.tone,
            step.args?.context
          );

          // Emit stack event for function completion
          await emitStackEvent("functionComplete", {
            functionName: step.name,
            result: result,
          });

          stepResults.push({ step: step.name, result });
          contents.push({
            role: "user",
            content: `Function ${step.name} result: ${result}`,
          });
        } else if (step.name === "prompt") {
          if (!step.args?.question) {
            contents.push({ role: "user", content: "Error: Missing question" });
            break;
          }
          // Emit stack event for function start
          await emitStackEvent("functionStart", {
            functionName: step.name,
            args: step.args,
          });

          const result = await prompt(step.args.question);

          // Emit stack event for function completion
          await emitStackEvent("functionComplete", {
            functionName: step.name,
            result: result,
          });

          stepResults.push({ step: step.name, result });
          contents.push({
            role: "user",
            content: `Function ${step.name} result: ${result}`,
          });
        } else if (step.name === "languageDetector") {
          if (!step.args?.text) {
            contents.push({
              role: "user",
              content: "Error: Missing text for language detection",
            });
            break;
          }
          // Emit stack event for function start
          await emitStackEvent("functionStart", {
            functionName: step.name,
            args: step.args,
          });

          const result = await languageDetector(step.args.text);

          // Emit stack event for function completion
          await emitStackEvent("functionComplete", {
            functionName: step.name,
            result: result,
          });

          stepResults.push({ step: step.name, result });
          contents.push({
            role: "user",
            content: `Function ${step.name} result: ${result}`,
          });
        } else if (step.name === "translate") {
          if (
            !step.args?.text ||
            !step.args?.sourceLanguage ||
            !step.args?.targetLanguage
          ) {
            contents.push({
              role: "user",
              content: "Error: Missing required arguments for translate",
            });
            break;
          }
          // await ensureTranslatorReady(
          //   step.args?.sourceLanguage,
          //   step.args?.targetLanguage
          // );
          // Emit stack event for function start
          await emitStackEvent("functionStart", {
            functionName: step.name,
            args: step.args,
          });

          const result = await translate(
            step.args?.text,
            step.args?.sourceLanguage,
            step.args?.targetLanguage
          );

          // Emit stack event for function completion
          await emitStackEvent("functionComplete", {
            functionName: step.name,
            result: result,
          });

          stepResults.push({ step: step.name, result });
          contents.push({
            role: "user",
            content: `Function ${step.name} result: ${result}`,
          });
        }
      }

      // After executing all steps, ask AI to provide final response and set continueFlag to false
      if (stepResults.length > 0) {
        contents.push({
          role: "user",
          content: `The previous function completed successfully. Here are the results: ${JSON.stringify(
            stepResults
          )}

Provide the final response with "continueFlag": false unless the user explicitly requested multiple actions.

REMEMBER: If you're providing finalResponse (no steps), use: {"finalResponse": "...", "continueFlag": false}
If you need to call another function, use: {"steps": [{"name": "...", "args": {...}}], "continueFlag": true}`,
        });
      }

      // Validate response format
      if (json?.steps && json?.finalResponse) {
        console.warn(
          "INVALID: LLM mixed function calls with final response. This should not happen."
        );
        console.warn("Response:", JSON.stringify(json));
        // Force continueFlag to true if there are steps to execute
        json.continueFlag = true;
        delete json.finalResponse;
      }

      // Only set finalResponse when continueFlag is explicitly false AND we have a finalResponse
      if (json?.continueFlag === false && json?.finalResponse) {
        finalResponse = json?.finalResponse;
      }

      // Set continueFlag from JSON response
      continueFlag = json?.continueFlag;
    } catch (error) {
      console.error("Error in iteration", iteration, ":", error);
      console.error("Response was:", response);

      // Handle user gesture errors
      if (
        error.name === "NotAllowedError" &&
        error.message.includes("user gesture")
      ) {
        console.warn(
          "User gesture required for AI APIs. Task cannot continue without user interaction."
        );
        return "Error: This task requires user interaction to access AI services. Please try running the task again.";
      }

      // If it's a JSON parsing error, try to give the AI another chance
      if (error.message.includes("JSON") && iteration < 3) {
        contents.push({
          role: "user",
          content: `ERROR: You must respond with valid JSON only. Your response was: "${response}". Please create a JSON plan with steps to process the selected text: "${selectedText}". Use the format: {"steps":[{"name":"function_name","args":{...}}],"continueFlag":true}`,
        });
        continue;
      }

      // If AI is asking for text that was already provided, give it another chance
      if (
        response.includes("need the selected text") ||
        response.includes("provide the text") ||
        response.includes("selected text")
      ) {
        contents.push({
          role: "user",
          content: `The selected text is: "${selectedText}". Please create a JSON plan to process this text. Use the format: {"steps":[{"name":"function_name","args":{...}}],"continueFlag":true}`,
        });
        continue;
      }

      return "Error: " + error.message;
    }
    // if (iteration > 2) {
    //   contents.push({
    //     role: "user",
    //     content:
    //       "Continue working on the user's request. If you need to call more functions to complete the task, do so now. Only provide a final response when you have fully completed all required steps.",
    //   });
    // }
    if (iteration >= 15) {
      console.warn("Max iterations reached. Breaking loop.");
      break;
    }
  }

  // If we couldn't get a proper response, return a fallback
  if (
    !finalResponse ||
    finalResponse.includes("need the selected text") ||
    finalResponse.includes("provide the text")
  ) {
    console.warn("AI failed to provide proper response, using fallback");
    return `I apologize, but I'm having trouble processing your request. The selected text is: "${selectedText}". Please try again or rephrase your instruction.`;
  }

  // Emit planning complete event
  await emitStackEvent("planningComplete", {
    finalResponse: finalResponse,
  });

  return finalResponse;
}
