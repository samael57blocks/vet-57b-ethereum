import type { Pet } from "../../types/pet";
import type { IPetService } from "../petService";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "../../../hooks/web3/contract";

/** Maps contract uint8 AnimalType to string */
const ANIMAL_TYPE_MAP: Record<number, Pet["animalType"]> = {
  0: "Dog",
  1: "Cat",
};

/**
 * Web3 implementation of PetService that reads directly from the VetRegistry contract.
 * Uses viem's public client (already available as a dependency).
 */
export const Web3PetService: IPetService = {
  getPets: async (): Promise<Pet[]> => {
    const { createPublicClient, http } = await import("viem");
    const { localhost } = await import("viem/chains");

    const publicClient = createPublicClient({
      chain: localhost,
      transport: http("http://127.0.0.1:8545"),
    });

    const count = await publicClient.readContract({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "getPetCount",
    });
    const countNum = Number(count);

    if (countNum === 0) return [];

    const pets: Pet[] = [];
    for (let i = 1; i <= countNum; i++) {
      const record = await publicClient.readContract({
        address: VET_REGISTRY_ADDRESS,
        abi: vetRegistryABI,
        functionName: "getMedicalRecord",
        args: [BigInt(i)],
      });

      const r = record as unknown as {
        name: string;
        age: number;
        animalType: number;
        caretakerName: string;
        caretakerPhone: string;
        owner: `0x${string}`;
      };
      pets.push({
        id: i.toString(),
        name: r.name,
        age: r.age,
        animalType: ANIMAL_TYPE_MAP[r.animalType] ?? "Dog",
        caretakerName: r.caretakerName,
        caretakerPhone: r.caretakerPhone,
        owner: r.owner,
      });
    }

    return pets;
  },
};
