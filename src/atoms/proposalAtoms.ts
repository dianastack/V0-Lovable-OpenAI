import { atom } from "jotai";
import type { Proposal, ProposalResult } from "@/lib/schemas";

export const proposalResultAtom = atom<ProposalResult | null>(null);
