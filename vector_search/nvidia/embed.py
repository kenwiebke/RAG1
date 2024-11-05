#this is a simple-ish script to load the sample documents and create the embeddings.  Clearly, this is not a professionally built Python application and is intended to demonstrate the basics.

import os
from dotenv import load_dotenv
from langchain_community.document_loaders.mongodb import MongodbLoader
import nest_asyncio
from openai import OpenAI


nest_asyncio.apply()
load_dotenv("../.env")

loader = MongodbLoader(
    connection_string=os.environ['MONGODB_URI'],
    db_name=os.environ['MONGODB_DB'],
    collection_name=os.environ['MONGODB_COLL'],
    filter_criteria={},
    field_names=["title", "plot"]
)
print("Load documentgs");
docs = loader.load()
# print ("len - " + str(len(docs)))
# print ("doc[0]")
print(docs[0])


print("\n\nCreate Embedding...\n")
#create embeddings
client = OpenAI(
  api_key=os.environ["OPENAI_API_KEY"],
  base_url="https://integrate.api.nvidia.com/v1"
)

response = client.embeddings.create(
    input=[docs[0].page_content],
    model="nvidia/nv-embed-v1",
    encoding_format="float",
    extra_body={"input_type": "query", "truncate": "NONE"}
)
# print(response.data[0].embedding)




