import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

export class GPTClient {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateText(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: options?.model || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
      });

      return completion.choices[0]?.message?.content || "";
    } catch (error) {
      throw new Error(
        `Failed to generate text: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async generateImage(
    prompt: string,
    options?: {
      model?: string;
      width?: number;
      height?: number;
      seed?: number;
      nologo?: boolean;
      private?: boolean;
      enhance?: boolean;
      safe?: boolean;
    }
  ): Promise<string> {
    try {
      const config = {
        model: options?.model || "flux",
        width: options?.width || 1024,
        height: options?.height || 1024,
        seed: options?.seed || Math.floor(Math.random() * 1000000),
        nologo: options?.nologo !== undefined ? options.nologo : true,
        private: options?.private || false,
        enhance: options?.enhance || false,
        safe: options?.safe !== undefined ? options.safe : true,
      };

      // Build Pollinations.ai URL
      const baseURL = "https://image.pollinations.ai/prompt/";
      const encodedPrompt = encodeURIComponent(prompt);
      const url = new URL(`${baseURL}${encodedPrompt}`);

      // Add query parameters
      Object.entries(config).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString());
        }
      });

      console.log(`🎨 Generating image with Pollinations.ai: "${prompt}"`);
      console.log(`🔗 Image URL: ${url.toString()}`);

      // Return the direct image URL instead of downloading and saving
      return url.toString();
    } catch (error) {
      throw new Error(
        `Failed to generate image URL with Pollinations.ai: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async fetchImageFromPollinations(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      // Set timeout
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  /**
   * Get available image models from Pollinations.ai
   */
  async getAvailableImageModels(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      https.get("https://image.pollinations.ai/models", (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            const models = JSON.parse(data);
            resolve(models);
          } catch (error) {
            reject(new Error("Failed to parse models response"));
          }
        });
      }).on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate multiple images and return their URLs
   */
  async generateImages(
    prompts: string[],
    options?: {
      model?: string;
      width?: number;
      height?: number;
    }
  ): Promise<string[]> {
    const results: string[] = [];

    for (const prompt of prompts) {
      try {
        const imageUrl = await this.generateImage(prompt, options);
        results.push(imageUrl);
      } catch (error) {
        console.error(`Failed to generate image for prompt "${prompt}":`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Generate image and save it to file (optional utility method)
   */
  async generateAndSaveImage(
    prompt: string,
    options?: {
      model?: string;
      width?: number;
      height?: number;
      seed?: number;
      nologo?: boolean;
      private?: boolean;
      enhance?: boolean;
      safe?: boolean;
      outputDir?: string;
      filename?: string;
    }
  ): Promise<{ url: string; filePath: string }> {
    try {
      // Get the image URL
      const imageUrl = await this.generateImage(prompt, options);

      // Download and save the image
      const imageBuffer = await this.fetchImageFromPollinations(imageUrl);

      // Prepare output directory and filename
      const outputDir = options?.outputDir || "./images";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = options?.filename || `pollinations-${timestamp}.jpg`;

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Ensure filename has extension
      const finalFilename = path.extname(filename) ? filename : `${filename}.jpg`;
      const filePath = path.join(outputDir, finalFilename);

      // Save image to file
      fs.writeFileSync(filePath, imageBuffer);

      console.log(`✅ Image saved to: ${filePath}`);
      return { url: imageUrl, filePath };
    } catch (error) {
      throw new Error(
        `Failed to generate and save image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}