/**
 * Vertical offset (px, chip is pushed up) for a frame's header chip. Frames of
 * the two segmentation models routinely overlap (both models segment the same
 * concepts), so their header chips can land on the same top line and cover
 * each other's label text. Each chip whose center line would come within one
 * chip step of an earlier, horizontally-overlapping frame's chip is pushed up
 * until they no longer collide.
 */
const HEADER_STEP = 28;

export type FrameRect = { x: number; y: number; width: number; height: number };

export function assignHeaderOffsets(rects: FrameRect[]): number[] {
	const offsets: number[] = [];
	for (let i = 0; i < rects.length; i++) {
		const a = rects[i];
		let offset = 0;
		for (let j = 0; j < i; j++) {
			const b = rects[j];
			const overlapsX = a.x < b.x + b.width && b.x < a.x + a.width;
			if (!overlapsX) continue;
			// Chip center lines: a.y - offset vs b.y - offsets[j].
			const separation = Math.abs(a.y - offset - (b.y - offsets[j]));
			if (separation < HEADER_STEP) {
				offset += HEADER_STEP - separation;
			}
		}
		offsets.push(offset);
	}
	return offsets;
}
