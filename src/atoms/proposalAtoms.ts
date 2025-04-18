import { atom } from "jotai";
import type { CodeProposal, ProposalResult } from "@/lib/schemas";

export const proposalResultAtom = atom<ProposalResult | null>(null);
