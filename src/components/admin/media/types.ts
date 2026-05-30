/**
 * Phase 3 ImagePicker shared types.
 *
 * `PickedMedia` is what the picker resolves with — the minimum a consuming
 * form needs to bind the choice to its own value (publicId for storage, url
 * for an immediate preview before the next render through `cldUrl`, alt for
 * default a11y text the user can override).
 */

export type PickedMedia = {
  publicId: string;
  url: string;
  alt: string;
};

export type ImagePickerKind = 'image' | 'pdf';

export type OpenImagePickerOpts = {
  kind?: ImagePickerKind;
};

export type OpenImagePicker = (
  opts?: OpenImagePickerOpts,
) => Promise<PickedMedia | null>;
