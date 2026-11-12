export interface FileUploadResult {
  id: string
  fileType: 'avatar' | 'attachment'
  key: string
  url: string
  fileName: string
  fileExtension: string
  contentType: string
  fileSize: number
}
