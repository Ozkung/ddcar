'use client'

import { Image } from 'antd'

interface Props {
  images: { id: string; filename: string }[]
  jobId: string
}

export default function ImageGallery({ images, jobId }: Props) {
  if (images.length === 0) return null

  return (
    <Image.PreviewGroup>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {images.map(img => (
          <Image
            key={img.id}
            src={`/api/uploads/${jobId}/${img.filename}`}
            width={120}
            height={120}
            style={{ objectFit: 'cover', borderRadius: 8 }}
            alt={img.filename}
          />
        ))}
      </div>
    </Image.PreviewGroup>
  )
}
