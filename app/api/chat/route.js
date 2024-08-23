import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Set global fetch
if (!global.fetch) {
    global.fetch = fetch;
}

const systemPrompt = `
You are a rate my professor agent to help students find classes, that takes in user questions and answers them.
For every user question, the top 3 professors that match the user question are returned.
Use them to answer the question if needed. Always format your responses using Markdown.`;

export async function POST(req) {
    try {
        const data = await req.json();

        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pc.index('rag').namespace('ns1');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

        const text = data[data.length - 1].content;

        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const embeddingResult = await embeddingModel.embedContent(text);
        const embedding = embeddingResult.embedding["values"];

        if (!Array.isArray(embedding) || embedding.some(val => typeof val !== 'number')) {
            throw new Error('Invalid embedding format');
        }

        const results = await index.query({
            topK: 5,
            includeMetadata: true,
            vector: embedding,
        });

        let resultString = '';
        results.matches.forEach((match) => {
            resultString += `
            Returned Results:
            Professor: ${match.id}
            Review: ${match.metadata.review}
            Subject: ${match.metadata.subject}
            Stars: ${match.metadata.stars}
            \n\n`;
        });

        const lastMessage = data[data.length - 1];
        const lastMessageContent = lastMessage.content + resultString;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Create chat history in the correct format
        const chatHistory = data.map(msg => ({
            role: msg.role === 'human' ? 'user' : (msg.role === 'assistant' ? 'model' : msg.role),
            parts: [{ text: msg.content }]
        }));

        // Add system prompt as the first message
        chatHistory.unshift({
            role: 'user',
            parts: [{ text: systemPrompt }]
        });

        // Add the last message with results
        chatHistory.push({
            role: 'user',
            parts: [{ text: lastMessageContent }]
        });

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });

        const result = await chat.sendMessage(lastMessageContent);
        const responseText = result.response.text();

        return NextResponse.json({ response: responseText });

    } catch (error) {
        console.error("Chat initialization error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}