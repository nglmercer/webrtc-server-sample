/**
 * WebRTC Libraries Compatibility Layer for Bun
 * 
 * This module provides a unified interface for WebRTC functionality
 * using Bun-compatible libraries.
 */

import { NodeDataChannelWebRTC } from './node-datachannel.js';
import { SimplePeerWebRTC } from './simple-peer.js';
import { EnhancedWebRTC } from './enhanced-webrtc.js';
import { NodeDataChannelWebRTCReal } from './node-datachannel-real.js';
import type { WebRTCProvider, WebRTCConfig, RTCConfiguration } from './types.js';

export { NodeDataChannelWebRTC, SimplePeerWebRTC };
export { EnhancedWebRTC } from './enhanced-webrtc';
export { NodeDataChannelWebRTCReal } from './node-datachannel-real';
export type { WebRTCProvider, WebRTCConfig, RTCConfiguration } from './types.js';

/**
 * Factory function to create the appropriate WebRTC provider
 * @param providerType - The type of provider to create ('node-datachannel', 'simple-peer', or 'enhanced')
 * @param config - Configuration options for the WebRTC provider
 * @returns A WebRTC provider instance
 */
export function createWebRTCProvider(
  providerType: 'node-datachannel' | 'simple-peer' | 'enhanced' | 'node-datachannel-real' = 'enhanced',
  config?: WebRTCConfig
): WebRTCProvider {
  switch (providerType) {
    case 'node-datachannel':
      return new NodeDataChannelWebRTC(config);
    case 'simple-peer':
      return new SimplePeerWebRTC(config);
    case 'enhanced':
      return new EnhancedWebRTC(config);
    case 'node-datachannel-real':
      return new NodeDataChannelWebRTCReal(config);
    default:
      throw new Error(`Unsupported WebRTC provider: ${providerType}`);
  }
}

/**
 * Get the recommended WebRTC provider for Bun
 * @param config - Configuration options
 * @returns The recommended WebRTC provider for Bun environment
 */
export function getRecommendedBunProvider(config?: WebRTCConfig): WebRTCProvider {
  // Check if we should use real implementation for production
  const useReal = process.env.NODE_ENV === 'production' || process.env.USE_REAL_WEBRTC === 'true';
  
  if (useReal) {
    console.log('🌐 Using REAL WebRTC implementation for production');
    return new NodeDataChannelWebRTCReal(config);
  }
  
  // Default to enhanced for development/testing
  return new EnhancedWebRTC(config);
}

/**
 * Check if a WebRTC provider is available and working
 * @param providerType - The provider type to check
 * @returns True if the provider is available
 */
export function isProviderAvailable(providerType: 'node-datachannel' | 'simple-peer' | 'enhanced' | 'node-datachannel-real'): boolean {
  try {
    switch (providerType) {
      case 'node-datachannel':
        require('node-datachannel');
        return true;
      case 'simple-peer':
        require('simple-peer');
        return true;
      case 'enhanced':
        return true; // Enhanced provider is always available (built-in)
      case 'node-datachannel-real':
        require('node-datachannel');
        return true; // Same library as node-datachannel
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Get all available WebRTC providers
 * @returns Array of available provider names
 */
export function getAvailableProviders(): Array<'node-datachannel' | 'simple-peer' | 'enhanced' | 'node-datachannel-real'> {
  const providers: Array<'node-datachannel' | 'simple-peer' | 'enhanced' | 'node-datachannel-real'> = [];
  
  if (isProviderAvailable('node-datachannel')) {
    providers.push('node-datachannel');
  }
  
  if (isProviderAvailable('simple-peer')) {
    providers.push('simple-peer');
  }

  if (isProviderAvailable('enhanced')) {
    providers.push('enhanced');
  }

  if (isProviderAvailable('node-datachannel-real')) {
    providers.push('node-datachannel-real');
  }
  
  return providers;
}

// Export: main classes directly for convenience
export { NodeDataChannelWebRTC as WebRTC } from './node-datachannel';
export { NodeDataChannelWebRTCReal as WebRTCReal } from './node-datachannel-real';
