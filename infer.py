import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

model_id = "meta-llama/Meta-Llama-3-8B-Instruct"
peft_id = "namespace-Pt/Llama-3-8B-Instruct-80K-QLoRA"

torch_dtype = torch.bfloat16
# place the model on GPU
device_map = {"": "cuda"}

tokenizer = AutoTokenizer.from_pretrained(model_id)

base_model = AutoModelForCausalLM.from_pretrained(
  model_id, 
  torch_dtype=torch.bfloat16,
  device_map=device_map,
  attn_implementation="flash_attention_2",

  # NOTE: expand rope base
  rope_theta=200e6,
)

model = PeftModel.from_pretrained(
    base_model, 
    peft_id,
    torch_dtype=torch.bfloat16,
    device_map=device_map,
)
# NOTE: merge LoRA weights
model = model.merge_and_unload().eval()

with torch.no_grad():
  # short context
  messages = [{"role": "user", "content": "Tell me about your history."}]
  inputs = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt", return_dict=True).to("cuda")
  outputs = model.generate(**inputs, max_new_tokens=50)[:, inputs["input_ids"].shape[1]:]
  print(f"Input Length: {inputs['input_ids'].shape[1]}")
  print(f"Output:       {tokenizer.decode(outputs[0])}")

#   # long context
#   with open("data/narrativeqa.json", encoding="utf-8") as f:
#     example = json.load(f)
#   messages = [{"role": "user", "content": example["context"]}]
#   inputs = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt", return_dict=True).to("cuda")
#   outputs = model.generate(**inputs, do_sample=False, top_p=1, temperature=1, max_new_tokens=20)[:, inputs["input_ids"].shape[1]:]
#   print("*"*20)
#   print(f"Input Length: {inputs['input_ids'].shape[1]}")
#   print(f"Answers:      {example['answer']}")
#   print(f"Prediction:   {tokenizer.decode(outputs[0])}")