import type { OwnProfile, UpdateOwnProfilePayload } from '../types/profile'

import { http } from './http'

const PROFILE_PATH = '/users/me'

export const profileService = {
  get: (token: string | null) => http.get<OwnProfile>(PROFILE_PATH, { token }),

  update: (payload: UpdateOwnProfilePayload, token: string | null) =>
    http.patch<OwnProfile>(PROFILE_PATH, payload, { token }),
}
