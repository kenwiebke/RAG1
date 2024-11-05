"use strict";

import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import * as fs from 'fs';


class MovieSearch  {
    constructor(env) {
        this.env = env;
    }


    _logWithTimestamp(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }

    async search(query) {
        this._logWithTimestamp(`search called with query: ${query}`);

        const mongoDB = this.env.MONGODB_DB;
        const cluster = this.env.MONGODB_URI;
        var client = new MongoClient(cluster);

        try {
            await client.connect();
            const db = client.db(mongoDB);
            const collection = db.collection(this.env.MONGODB_VECTOR_COLL_LANGCHAIN);
            const embeddings = new OpenAIEmbeddings({
                model: this.env.EMBEDDING_MODEL,
                batchSize: 50,
                maxConcurrency: 5,
              });  
            const vectorSearch = new MongoDBAtlasVectorSearch(embeddings, {
                collection: collection,
                indexName: this.env.MONGODB_VECTOR_INDEX,
                embeddingKey: this.env.MONGODB_EMBEDDING_FIELD, 
            });

            // get relevant documents (movies)
            const movieList = await vectorSearch.similaritySearch(query, 5);
            this._logWithTimestamp(`Returned ${movieList.length} results`);
            const movies = movieList.map(movie => movie.pageContent + "\n"); // stringify the movies
            const prompt = new PromptTemplate({
//                template: "You are a movie critic and recommendation engine.  Provide a concise summary of the following movies: {movies}",
                template: "You are a movie critic and recommendation engine.  Recommend the top two movies and provide a concise summary of them from the following movies: {movies}",
                inputVariables: ["movies"],
            });

        
            const llm = new ChatOpenAI({
                model: this.env.OPENAI_MODEL,
                openAIApiKey: this.env.OPENAI_API_KEY,
                temperature: 0.5,
                max_tokens: 1024,
                config: {
                    baseURL: this.env.OPENAI_BASE_URL,
                }
            });
             const llmPrompt = await prompt.format({movies: movies});
             //this._logWithTimestamp(`prompt: ${llmPrompt}`);
            
             this._logWithTimestamp("\n\nCalling LLM\n\n");
            const result = await llm.invoke(llmPrompt);
            this._logWithTimestamp(result.content);

            // todo look into chain and runnables as well as retriever to simplify the code above.  
            /*
            const retriever = vectorSearch.asRetriever();
            const chain = RunnableSequence.from([
                //{
                  // context: retriever.pipe(formatDocumentsAsString),
                  //question: new RunnablePassthrough(),
                //},
                prompt,
                model,
                new StringOutputParser(),
              ]);
        */
        }
        catch (error) {
            this._logWithTimestamp(`Error connecting to MongoDB: ${error}`);
        }   
        finally {
            await client.close();
        }
    }
}

export { MovieSearch }; 