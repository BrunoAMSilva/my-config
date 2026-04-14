# my-config

To install dependencies:

```bash
bun install
```

To launch the interactive command deck:

```bash
bun run index.ts
```

That opens a terminal UI with arrow-key navigation, numeric shortcuts, text input for Hugging Face sources, and grouped actions for models, backup, restore, and coding tasks.

To initialize the shared local model config in the Models folder under your home directory:

```bash
bun run models:init
```

That creates or updates the `llms` section inside the package manifest in your home Models directory by default. You can override the location with `MODELS_DIR`.

Example config:

```json
{
	"name": "llm-central",
	"private": true,
	"llms": {
		"configVersion": 1,
		"models": [
			{
				"id": "qwen2.5-coder-7b-instruct-q4-k-m",
				"provider": "huggingface",
				"repo": "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
				"revision": "main",
				"targetDir": "qwen2.5-coder-7b-instruct",
				"files": [
					"qwen2.5-coder-7b-instruct-q4_k_m.gguf"
				]
			}
		]
	}
}
```

To inspect configured models:

```bash
bun run models:list
```

To add a Hugging Face model without editing JSON manually:

```bash
bun run models:add-hf qwen2.5-coder-7b-instruct-q4-k-m Qwen/Qwen2.5-Coder-7B-Instruct-GGUF qwen2.5-coder-7b-instruct-q4_k_m.gguf main qwen2.5-coder-7b-instruct
```

If you prefer the UI, open the dashboard and choose `Models` -> `Add Hugging Face model`, then paste either a repo like `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF` or a full Hugging Face file URL.

If a model needs more than one file, pass them as a comma-separated list:

```bash
bun run index.ts models add-hf my-vision-model my-org/my-vision-repo model.gguf,mmproj.gguf main my-vision-model
```

To download one configured model from Hugging Face into `~/Models`:

```bash
bun run index.ts models pull qwen2.5-coder-7b-instruct-q4-k-m
```

To download all configured models:

```bash
bun run index.ts models pull all
```

If a model requires authentication, set `HF_TOKEN` before pulling it.

Other direct command groups:

```bash
bun run index.ts backup config
bun run index.ts backup models
bun run index.ts restore config
bun run index.ts restore skills
bun run index.ts restore models
bun run index.ts coding sync-skills
```
