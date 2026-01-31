import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";
import { DraftlyNode } from "draftly";
import React from "react";

type Props = {
  setShowNodes: (show: boolean) => void;
  nodes: DraftlyNode[];
};

export default function Devbar({ setShowNodes, nodes }: Props) {
  return (
    <div className="h-full w-full">
      <div className="text-muted-foreground font-mono text-center whitespace-nowrap h-10 p-2 border-b">
        Developer Panel
      </div>

      <div className="h-[calc(100%-2.5rem)]">
        <Accordion
          type="single"
          collapsible
          className="w-full h-full"
          onValueChange={(value) => setShowNodes(value === "nodes")}
        >
          <AccordionItem value="nodes" className="h-full [&>div]:h-[calc(100%-2.5rem)]">
            <AccordionTrigger className="p-2 border-b rounded-none hover:no-underline cursor-pointer hover:bg-accent hover:text-accent-foreground">
              <div>
                Nodes <span className="text-muted-foreground text-xs">(Hide for performance)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="max-h-full overflow-y-scroll h-full">
              <NodeViewer nodes={nodes} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

function NodeViewer({ nodes, depth = 0 }: { nodes: DraftlyNode[]; depth?: number }) {
  return (
    <div className="font-mono text-xs">
      {nodes.map((node, idx) => (
        <div key={`${node.name}-${node.from}-${idx}`}>
          <div
            className={`flex items-center gap-2 py-0.5 px-1 rounded ${node.isSelected ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
          >
            <span className="font-semibold">{node.name}</span>
            <span className="text-muted-foreground">
              [{node.from}:{node.to}]
            </span>
          </div>
          {node.children.length > 0 && <NodeViewer nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}
