"use client"

import type React from "react"

import { useState } from "react"

interface CSVUploadAreaProps {
  onFileUpload: (file: File) => void
}

export default function CSVUploadArea({ onFileUpload }: CSVUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        onFileUpload(file)
      }
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      onFileUpload(files[0])
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
      }`}
    >
      <input type="file" accept=".csv" onChange={handleFileInput} id="csv-upload" className="hidden" />
      <label htmlFor="csv-upload" className="cursor-pointer">
        <p className="font-medium">Drag CSV here or click to select</p>
        <p className="text-sm text-muted-foreground mt-1">Supports files up to 10MB</p>
      </label>
    </div>
  )
}
