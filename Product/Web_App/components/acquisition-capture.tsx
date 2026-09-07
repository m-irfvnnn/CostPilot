'use client'

import { useEffect } from 'react'
import { captureAndStoreAcquisitionContext } from '@/lib/acquisition-browser'

export function AcquisitionCapture() {
  useEffect(() => {
    captureAndStoreAcquisitionContext()
  }, [])

  return null
}
