from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

client = NVIDIAEmbeddings(
  model="nvidia/nv-embed-v1", 
  api_key="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", 
  truncate="NONE", 
  )

embedding = client.embed_query("Nebraska Cornhuskers have won 3 college football championships?")
print(embedding)