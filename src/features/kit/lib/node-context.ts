import { createContext, useContext } from "react";

export const NodeContext = createContext<{
	readOnly: boolean;
	/** Updates a node's data through the owning editor (controlled flows). */
	onUpdateNodeData?: (id: string, data: Record<string, unknown>) => void;
}>({ readOnly: false });

export const useNodeContext = () => useContext(NodeContext);
