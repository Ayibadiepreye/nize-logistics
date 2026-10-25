/**
 * Type declarations for `open-location-code`.
 *
 * The package ships no types, and there is no @types package for it. Only the
 * surface this project uses is declared.
 */
declare module 'open-location-code' {
  export interface CodeArea {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    latitudeCenter: number;
    longitudeCenter: number;
    codeLength: number;
  }

  export class OpenLocationCode {
    constructor();

    /** Encode a latitude/longitude pair into a Plus Code of the given length. */
    encode(latitude: number, longitude: number, codeLength?: number): string;

    /** Decode a Plus Code into the area it covers. Throws on an invalid code. */
    decode(code: string): CodeArea;

    /** True when the code is well-formed (padding and alphabet correct). */
    isValid(code: string): boolean;

    /** True when the code is complete and needs no reference location. */
    isFull(code: string): boolean;

    /** True when the code is a shortened code that needs a reference location. */
    isShort(code: string): boolean;

    /**
     * Shorten a full code against a reference point.
     * Returns the original code when the reference is too far away.
     */
    shorten(code: string, referenceLatitude: number, referenceLongitude: number): string | null;

    /** Recover a shortened code using the reference point it was shortened with. */
    recoverNearest(
      code: string,
      referenceLatitude: number,
      referenceLongitude: number
    ): string | null;
  }
}
