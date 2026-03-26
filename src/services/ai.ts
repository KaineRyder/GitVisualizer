import { GoogleGenAI, Type } from "@google/genai";
import { ProjectAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mainLanguages: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "项目使用的主要编程语言列表。",
    },
    techStack: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "检测到的框架、库和技术栈列表。",
    },
    entryPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "潜在的项目入口文件列表（例如：main.c, App.tsx, index.js）。",
    },
    summary: {
      type: Type.STRING,
      description: "根据文件结构对项目用途进行的 1-2 句简短中文总结。",
    },
  },
  required: ["mainLanguages", "techStack", "entryPoints", "summary"],
};

const VERIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isEntryPoint: {
      type: Type.BOOLEAN,
      description: "该文件是否是项目的真实入口文件。",
    },
    reason: {
      type: Type.STRING,
      description: "判断该文件是否为入口文件的理由（中文）。",
    },
  },
  required: ["isEntryPoint", "reason"],
};

const SUB_FUNCTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subFunctions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "子函数名。" },
          file: { type: Type.STRING, description: "该函数可能定义在哪个文件中（相对路径）。" },
          description: { type: Type.STRING, description: "函数简介功能介绍。" },
          drillDown: { 
            type: Type.INTEGER, 
            description: "是否值得进一步下钻分析（-1:不需要, 0:不确定, 1:需要）。" 
          },
        },
        required: ["name", "file", "description", "drillDown"],
      },
      description: "识别出的关键子函数列表，不超过 20 个。",
    },
  },
  required: ["subFunctions"],
};

export async function analyzeProject(fileList: string[]): Promise<{ result: ProjectAnalysis; request: any; response: any }> {
  const prompt = `分析以下 GitHub 仓库文件列表，并提供结构化的 JSON 分析结果。请务必使用中文进行总结。
      文件列表：
      ${fileList.join("\n")}
      
      重点识别主要编程语言、技术栈（框架/库）以及潜在的入口文件。`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: ANALYSIS_SCHEMA,
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config,
    });

    const result = JSON.parse(response.text || "{}");
    return { 
      result: result as ProjectAnalysis, 
      request: { prompt, config }, 
      response: { text: response.text } 
    };
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw new Error("Failed to analyze project with AI");
  }
}

export async function verifyEntryPoint(
  repoUrl: string,
  summary: string,
  languages: string[],
  fileName: string,
  fileContent: string
): Promise<{ result: { isEntryPoint: boolean; reason: string }; request: any; response: any }> {
  const prompt = `研判以下文件是否为项目的真实入口文件。
      
      项目信息：
      - GitHub 链接: ${repoUrl}
      - 项目简介: ${summary}
      - 编程语言: ${languages.join(", ")}
      
      待研判文件: ${fileName}
      文件内容:
      ${fileContent}
      
      请分析该文件是否为项目的启动点或核心入口。`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: VERIFICATION_SCHEMA,
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config,
    });

    const result = JSON.parse(response.text || "{}");
    return {
      result: result as { isEntryPoint: boolean; reason: string },
      request: { prompt, config },
      response: { text: response.text }
    };
  } catch (error) {
    console.error("AI Entry Point Verification failed:", error);
    throw new Error("Failed to verify entry point with AI");
  }
}

export async function identifySubFunctions(
  repoUrl: string,
  summary: string,
  fileName: string,
  fileContent: string,
  fileList: string[]
): Promise<{ result: { subFunctions: any[] }; request: any; response: any }> {
  const prompt = `根据项目的简介、核心功能逻辑，研判以下函数中调用的关键子函数。
      
      项目信息：
      - GitHub 链接: ${repoUrl}
      - 项目简介: ${summary}
      - 项目文件列表：
      ${fileList.slice(0, 100).join("\n")} (仅展示前100个文件)
      
      当前分析文件: ${fileName}
      文件内容:
      ${fileContent}
      
      请识别该文件中调用的关键子函数，数量不超过 20 个。
      对于每一个子函数，请研判：
      1. 是否值得进一步下钻分析（-1:不需要, 0:不确定, 1:需要）
      2. 该函数可能定义在哪个文件中（基于文件列表和上下文推断）
      3. 函数简介功能介绍`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: SUB_FUNCTION_SCHEMA,
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config,
    });

    const result = JSON.parse(response.text || "{}");
    return {
      result: result as { subFunctions: any[] },
      request: { prompt, config },
      response: { text: response.text }
    };
  } catch (error) {
    console.error("AI Sub-function Identification failed:", error);
    throw new Error("Failed to identify sub-functions with AI");
  }
}
