/**
 * WebRTC Libraries Compatibility Layer for Bun
 * 
 * This module provides a unified interface for WebRTC functionality
 * using Bun-compatible libraries.
 */

import { NodeDataChannelWebRTC } from './node-datachannel.js';
import { SimplePeerWebRTC } from './simple-peer.js';
import { EnhancedWebRTC } from './enhanced-webrtc.js';
import type { WebRTCProvider, WebRTCConfig, RTCConfiguration } from './types.js';

export { NodeDataChannelWebRTC, SimplePeerWebRTC };
export { EnhancedWebRTC } from './enhanced-webrtc';
export type { WebRTCProvider, WebRTCConfig, RTCConfiguration } from './types.js';

/**
 * Factory function to create the appropriate WebRTC provider
 * @param providerType - The type of provider to create ('node-datachannel', 'simple-peer', or 'enhanced')
 * @param config - Configuration options for the WebRTC provider
 * @returns A WebRTC provider instance
 */
export function createWebRTCProvider(
  providerType: 'node-datachannel' | 'simple-peer' | 'enhanced' = 'enhanced',
  config?: WebRTCConfig
): WebRTCProvider {
  switch (providerType) {
    case 'node-datachannel':
      return new NodeDataChannelWebRTC(config);
    case 'simple-peer':
      return new SimplePeerWebRTC(config);
    case 'enhanced':
      return new EnhancedWebRTC(config);
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
  return new EnhancedWebRTC(config);
}

/**
 * Check if a WebRTC provider is available and working
 * @param providerType - The provider type to check
 * @returns True if the provider is available
 */
export function isProviderAvailable(providerType: 'node-datachannel' | 'simple-peer' | 'enhanced'): boolean {
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
export function getAvailableProviders(): Array<'node-datachannel' | 'simple-peer' | 'enhanced'> {
  const providers: Array<'node-datachannel' | 'simple-peer' | 'enhanced'> = [];
  
  if (isProviderAvailable('node-datachannel')) {
    providers.push('node-datachannel');
  }
  
  if (isProviderAvailable('simple-peer')) {
    providers.push('simple-peer');
  }

  if (isProviderAvailable('enhanced')) {
    providers.push('enhanced');
  }
  
  return providers;
}

// Export the main classes directly for convenience
export { NodeDataChannelWebRTC as WebRTC } from './node-datachannel';
