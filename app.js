import env from 'dotenv';
import { title } from 'process';
import { DocumentLoader } from './vector_search/DocumentLoader.js';
import readline from 'readline';
import { MovieSearch } from './vector_search/search.js';


/*
 * The purpose of this app is to load the vectors for the movie titles and plots into MongDB to use for vector searches.
 */

async function getUserChoice() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Please select an option:\n1. Create vector search embeddings\n2. Search documents\n0. Exit\nEnter your choice (0, 1 or 2): ', (choice) => {
            rl.close();
            resolve(choice.trim());
        });
    });
}

async function getUserQuery() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Enter your query: ', (query) => {
            rl.close();
            resolve(query.trim());
        });
    });
}

async function main() {
    console.clear();
    try {
        let running = true;
        while (running) {
            console.log("\n\n=============================================");
            console.log("Vector Search Sample App");
            console.log("=============================================\n\n");
            const loader = new DocumentLoader(process.env);
            const movieSearch = new MovieSearch(process.env);

            const choice = await getUserChoice();
            
            switch(choice) {
                case '1':
                    await loader.clearEmbeddings();
                    await loader.createVectorSearchEmbeddings1();
                    break;
                case '2':
                    const query = await getUserQuery();
                    await movieSearch.search(query);
                    break;
                case '0':
                    running = false;
                    console.log('Exiting...');
                    break;
                default:
                    console.log('Invalid choice. Please try again.');
            }
        }
    } catch (e) {
        console.error('Error:', e);
    } 
}



env.config();
 main().catch(console.error);