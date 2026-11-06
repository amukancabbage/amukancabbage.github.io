-- Samakan model AI dengan bawaan app_haki (config/haki.php).
update public.hki_settings set value = '"google/gemini-3.1-flash-lite"' where key in ('ai.model_classify', 'ai.model_extract');
update public.hki_settings set value = '"openai/gpt-6-luna"' where key = 'ai.model_fallback';
update public.hki_settings set value = '"anthropic/claude-sonnet-5.5"' where key = 'ai.model_escalate';
