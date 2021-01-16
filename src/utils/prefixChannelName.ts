import { ARTIST_COUNT_HASH } from '../constants';

export function prefixChannelName(artistName: string): string {
  return `${ARTIST_COUNT_HASH}:${artistName}`;
}
