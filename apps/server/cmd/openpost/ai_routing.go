package main

import (
	"errors"
	"time"

	"github.com/openpost/backend/internal/ai"
	"github.com/openpost/backend/internal/config"
)

const (
	contentAIRequestTimeout = 150 * time.Second
	contentAIMaxRetries     = 12
)

func openRouterConfigs(cfg *config.Config) (ai.OpenRouterConfig, ai.OpenRouterConfig) {
	base := ai.OpenRouterConfig{
		APIKey:      cfg.OpenRouterAPIKey,
		HTTPReferer: cfg.PublicURL,
		XTitle:      "OpenPost",
	}
	imageConfig := base
	imageConfig.Provider = cfg.ImageCaptionProvider
	imageConfig.RequireZDR = cfg.ImageCaptionRequireZDR
	contentConfig := base
	contentConfig.Timeout = contentAIRequestTimeout
	contentConfig.MaxRetries = contentAIMaxRetries
	contentConfig.Provider = cfg.ContentAIProvider
	contentConfig.RequireZDR = cfg.ContentAIRequireZDR
	return imageConfig, contentConfig
}

func newContentGenerator(cfg *config.Config) (ai.Generator, error) {
	hasCompatibleAPIKey := cfg.TextGenerationAPIKey != ""
	hasCompatibleBaseURL := cfg.TextGenerationBaseURL != ""
	if hasCompatibleAPIKey || hasCompatibleBaseURL {
		if !hasCompatibleAPIKey {
			return nil, errors.New("OPENPOST_TEXT_GENERATION_API_KEY is required when a custom text-generation base URL is set")
		}
		if !hasCompatibleBaseURL {
			return nil, errors.New("OPENPOST_TEXT_GENERATION_BASE_URL is required when a custom text-generation API key is set")
		}
		return ai.NewOpenAICompatible(ai.OpenAICompatibleConfig{
			APIKey:     cfg.TextGenerationAPIKey,
			BaseURL:    cfg.TextGenerationBaseURL,
			Timeout:    contentAIRequestTimeout,
			MaxRetries: contentAIMaxRetries,
		})
	}
	if cfg.OpenRouterAPIKey == "" {
		return nil, nil
	}

	_, contentConfig := openRouterConfigs(cfg)
	return ai.NewOpenRouter(contentConfig)
}
