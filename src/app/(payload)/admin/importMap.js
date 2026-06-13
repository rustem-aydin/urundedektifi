import { BarcodeFieldClient as BarcodeFieldClient_d81889bbdf2b2d23386ff3e03e865db8 } from '@/collections/custom/BarcodeField/BarcodeFieldClient'
import { S3ClientUploadHandler as S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "@/collections/custom/BarcodeField/BarcodeFieldClient#BarcodeFieldClient": BarcodeFieldClient_d81889bbdf2b2d23386ff3e03e865db8,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1
}
