"use strict";

import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import OpenAI from 'openai';
import { Document } from "@langchain/core/documents"


class DocumentLoader  {
    constructor(env) {
        this.env = env;
    }

    _logWithTimestamp(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }

    /*
     * This is just to test that we can pull the data from MongoDB
     */
    async listDocuments() {
        // just to help debug
        //  console.log("listDocuments called");
        //console.log(this.env);
        const mongoDB = this.env.MONGODB_DB;
        const cluster = this.env.MONGODB_URI;
        var client = new MongoClient(cluster);
    
        try {
            this._logWithTimestamp("Connect to " + cluster);
            await client.connect();
            //await listDatabases(client);
            const db = client.db("sample_mflix");
            const movies = db.collection(this.env.MONGODB_COLL);
            const query = {};
    
            const options = {
                limit: 10,
                sort: { year: -1 },
                projection: { _id: 0, year: 1, title: 1, plot: 1 },
            };
            var cursor = movies.find({}, options);
            for await (const doc of cursor) {
                this._logWithTimestamp(doc);
            }
    
        } catch (e) {
            console.error(e);
        }
        finally {
            await client.close();
        }
    }
    
    async clearEmbeddings(){
        const mongoDB = this.env.MONGODB_DB;
        const cluster = this.env.MONGODB_URI;
        var client = new MongoClient(cluster);
    
        try {
            this._logWithTimestamp("Connect to " + cluster);
            await client.connect();
            const db = client.db(mongoDB);
            const vectorStore = db.collection(this.env.MONGODB_VECTOR_COLL_LANGCHAIN);
            const query = {};
            // need to add unset stuff
            const field = this.env.MONGODB_EMBEDDING_FIELD;
            const result = await vectorStore.updateMany(query, { $unset: { field : 1 }});
            // Print the number of deleted documents
            this._logWithTimestamp("Removed " + result.matchedCount + " " + field + " embeddings");    
        } 
        // don't catch errors; let them bubble up
        finally {
            await client.close();
        }

    }

    /*
     * This is the first version of creating the embeddings.  It uses the MongoDBAtlasVectorSearch helper classes, which simplifies the process, but is pretty restrictive in how it can be used.
     */ 
    async createVectorSearchEmbeddings1() {
        this._logWithTimestamp("Creating Vector Search Embeddings");
        const mongoDB = this.env.MONGODB_DB;
        const cluster = this.env.MONGODB_URI;
        var client = new MongoClient(cluster);

        const openai = new OpenAI({
            apiKey:  this.env.OPENAI_API_KEY,
            baseURL: this.env.OPENAI_BASE_URL,
          });
    


        try {
            this._logWithTimestamp("Connect to " + cluster);
            await client.connect();
            const db = client.db(mongoDB);
            const docs = await this.getDocuments(db);
            const vectorStore = db.collection(this.env.MONGODB_VECTOR_COLL_LANGCHAIN);
            
            const dbConfig = {  
                collection: vectorStore,
                indexName: this.env.MONGODB_VECTOR_INDEX, // The name of the Atlas search index to use.
                textKey: "text", // Field name for the raw text content. Defaults to "text".
                embeddingKey: this.env.MONGODB_EMBEDDING_FIELD, // Field name for the vector embeddings. Defaults to "embedding".
            };
            // trying to find the params that will work with NVIDIA
            const embeddings = new OpenAIEmbeddings({
                model: this.env.EMBEDDING_MODEL,
                batchSize: 50,
                maxConcurrency: 5,
              });            
            // Instantiate Atlas as a vector store 
            const vectorSearch = new MongoDBAtlasVectorSearch(embeddings, dbConfig );
            this._logWithTimestamp("add documents - " + docs.length);
            // Log the number of documents to be processed
            this._logWithTimestamp(`Adding ${docs.length} documents to vector store`);
            
            // Create options object with document IDs for vector storage
            const options = {
                // Map document IDs directly using array method instead of loop
                ids: docs.map(doc => doc.id)
                //ids: docs.map(doc => doc.id);
            };
            await vectorSearch.addDocuments(docs, options);
            await this.createVectorIndexLangChain(vectorStore);

        } catch (e) {
            console.error(e);
        }
        finally {
            await client.close();
            this._logWithTimestamp("DONE!\n");
        }

    }
    
    /*
    async createVectorSearchEmbeddings2() {
        this._logWithTimestamp("Creating Vector Search Embeddings");
        const mongoDB = this.env.MONGODB_DB;
        const cluster = this.env.MONGODB_URI;
        var client = new MongoClient(cluster);

        const openai = new OpenAI({
            apiKey:  this.env.OPENAI_API_KEY,
            baseURL: this.env.OPENAI_BASE_URL,
          });
    
        const dbConfig = {  
            collection: this.env.MONGODB_COLL,
            indexName: this.env.MONGODB_VECTOR_INDEX, // The name of the Atlas search index to use.
            textKey: "text", // Field name for the raw text content. Defaults to "text".
            embeddingKey: this.env.MONGODB_EMBEDDING_FIELD, // Field name for the vector embeddings. Defaults to "embedding".
        };

        try {
            this._logWithTimestamp("Connect to " + cluster);
            await client.connect();
            const db = client.db(mongoDB);
            var docs = await this.getDocuments(db);
            const movies = db.collection(this.env.MONGODB_COLL);
            // Instantiate Atlas as a vector store 
            //KLW - CANNOT use MongoDBAtlasVectorSearch with NVIDIA because we need to specify the "model"
            // const vectorStore = await MongoDBAtlasVectorSearch.fromDocuments(docs, new OpenAIEmbeddings(), dbConfig);
            for (const idx in docs)
            {
                const doc = docs[idx];
                this._logWithTimestamp(doc);
                var emb = await this.generateEmbedding(openai, doc.title + "\n" + doc.plot);
                this._logWithTimestamp("Embedding:\n"+emb[0]);
            }
        } catch (e) {
            console.error(e);
        }
        finally {
            await client.close();
            this._logWithTimestamp("DONE!\n");
        }

    }
   */
    /*
     * genereates the embedding for the provided text, aka, creates the floats
    async generateEmbedding(openAI, text) {
        const response = await openAI.embeddings.create({
            model: this.env.EMBEDDING_MODEL, 
            input: text
          });
          return response.data[0].embedding;
    }
     */
        
    async getDocuments(db) {
        this._logWithTimestamp("getDocuments");
        const docs = [];
        try {
            
            const collection = db.collection(this.env.MONGODB_COLL);
            const query = { plot: { $exists: true }};
    
            const options = {
                limit: 150,
                projection: { id:1, year: 1, title: 1, plot: 1, fullplot: 1 },
            };
            var cursor = collection.find({}, options);
            for await (const doc of cursor) {
             //   console.log(doc);
                // use the fullplot if it exists, otherwise use plot
                const plot = doc.fullplot ?? doc.plot;
                if (plot) {
                    const item = new Document ({
                        pageContent: `${doc.title}\n${plot}`,
                        metadata: { source:this.env.MONGODB_COLL,
                            year: doc.year
                         },
                        id: doc._id.toString()
                    });
                    docs.push( item );
                }
            }
            this._logWithTimestamp(`Retrieved ${docs.length} documents`);
        } catch (e) {
            console.error(e);
        }
        finally {
            return docs;
        }
    }

    /*
     * creates the vector search index
    * see https://www.mongodb.com/docs/atlas/atlas-vector-search/ai-integrations/langchain-js
     */ 
    async createVectorIndexLangChain(collection) {
        const indexes = await collection.listSearchIndexes(this.env.MONGODB_VECTOR_INDEX).toArray();
        if(indexes.length === 0){
            this._logWithTimestamp("createVectorIndexLangChain");
            // Define your Atlas Vector Search Index
           const index = {
              name: this.env.MONGODB_VECTOR_INDEX,
              type: "vectorSearch",
              definition: {
                 "fields": [
                    {
                       "type": "vector",
                       "numDimensions": 4096,
                       "path": this.env.MONGODB_EMBEDDING_FIELD,
                       "similarity": "cosine"
                    },
                    {
                       "type": "filter",
                       "path": "year"
                    }
                 ]
              }
           }
           this._logWithTimestamp("Index definition:\n" + JSON.stringify(index));
           // Run the helper method
           const result = await collection.createSearchIndex(index);
           this._logWithTimestamp(result);
           // Wait for Atlas to sync index
           this._logWithTimestamp("Waiting for initial sync...");
           await new Promise(resolve => setTimeout(() => {
              resolve();
           }, 10000));
        }
    }
        
};

export { DocumentLoader };
// module.exports =  DocumentLoader ; // KLW - learned the hard way that mixing this and ecmascript doesn't work.
