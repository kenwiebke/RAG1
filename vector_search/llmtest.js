
import OpenAI from 'openai';
import config from 'dotenv';
config.config();


const openai = new OpenAI({
  apiKey:  process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

async function main() {
  const completion = await openai.chat.completions.create({
    //model: "nvidia/llama-3.1-nemotron-70b-instruct", // times out too frequently
    // model:"meta/llama-3.1-405b-instruct",
    model: process.env.OPENAI_MODEL,
    messages: [{"role":"user","content":"Tell me a joke about Luke Skywalker"}],
    temperature: 0.5,
    top_p: 1,
    max_tokens: 1024,
    stream: true,
  })
   
  for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '')
  }
  
}

async function generateEmbedding(openAI, text) {
  const response = await openAI.embeddings.create({
      model: process.env.OPENAI_MODEL, // KLW - this is the wrong model; this shoudl be the embedding model
      input: text
    });
    console.log(response.data[0].embedding);
}


generateEmbedding(openai, "Michael Beau Geste leaves England in disgrace and joins the infamous French Foreign Legion. He is reunited with his two brothers in North Africa, where they face greater danger from their...,");
// main();