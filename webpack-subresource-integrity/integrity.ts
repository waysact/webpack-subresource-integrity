import { computeIntegrity } from "./util";

export class AssetIntegrity {
  hashFuncNames: string[];

  constructor(hashFuncNames: string[]) {
    this.hashFuncNames = hashFuncNames;
  }

  /**
   * @internal
   */
  private assetIntegrity: Map<string, string> = new Map();

  /**
   * @internal
   */
  private inverseAssetIntegrity: Map<string, string> = new Map();

  public update(assetKey: string, integrity: string): string {
    if (!this.assetIntegrity.has(assetKey)) {
      this.assetIntegrity.set(assetKey, integrity);
      this.inverseAssetIntegrity.set(integrity, assetKey);
    }
    return integrity;
  }

  public updateHash(input: Buffer[], oldHash: string): string | undefined {
    const assetKey = this.inverseAssetIntegrity.get(oldHash);
    if (assetKey && input.length === 1) {
      const newIntegrity = computeIntegrity(this.hashFuncNames, input[0]);
      this.inverseAssetIntegrity.delete(oldHash);
      this.assetIntegrity.delete(assetKey);
      this.update(assetKey, newIntegrity);

      return newIntegrity;
    }
    return undefined;
  }

  public updateFromSource(assetKey: string, source: string | Buffer): string {
    return this.update(assetKey, computeIntegrity(this.hashFuncNames, source));
  }

  public has(assetKey: string): boolean {
    return this.assetIntegrity.has(assetKey);
  }

  public get(assetKey: string): string | undefined {
    return this.assetIntegrity.get(assetKey);
  }
}
