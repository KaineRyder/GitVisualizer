import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FunctionNode } from '../types';
import { Maximize2, Minimize2, MousePointer2, Move } from 'lucide-react';

interface PanoramaProps {
  data: FunctionNode;
}

export const Panorama: React.FC<PanoramaProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const treeLayout = d3.tree<FunctionNode>()
      .nodeSize([150, 350]); // Indented tree style

    const root = d3.hierarchy(data);
    
    // Calculate indented positions
    let i = 0;
    root.eachBefore(d => {
      d.x = d.depth * 80; // Indentation
      d.y = i * 160;      // Vertical spacing
      i++;
    });

    const cardWidth = 260;
    const cardHeight = 110;
    const headerHeight = 35;

    // Draw links
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', 'var(--panorama-link, #e5e7eb)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,5')
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', d => {
        const source = d.source;
        const target = d.target;
        // Path: Start from bottom center of parent card, go down to child's y, then right to child's left
        return `M ${source.x + 20}, ${source.y + cardHeight / 2} 
                V ${target.y} 
                H ${target.x}`;
      });

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Node card
    node.append('rect')
      .attr('x', 0)
      .attr('y', -cardHeight / 2)
      .attr('width', cardWidth)
      .attr('height', cardHeight)
      .attr('rx', 12)
      .attr('fill', 'var(--panorama-node-bg, #fff)')
      .attr('stroke', d => d.data.drillDown === 1 ? '#3b82f6' : 'var(--panorama-node-border, #e5e7eb)')
      .attr('stroke-width', 2);

    // Header separator line
    node.append('line')
      .attr('x1', 0)
      .attr('y1', -cardHeight / 2 + headerHeight)
      .attr('x2', cardWidth)
      .attr('y2', -cardHeight / 2 + headerHeight)
      .attr('stroke', 'var(--panorama-node-border, #e5e7eb)')
      .attr('stroke-width', 1.5);

    // File Path (Header)
    node.append('text')
      .attr('x', 15)
      .attr('y', -cardHeight / 2 + 22)
      .attr('fill', 'var(--panorama-muted-text, #6b7280)')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('font-weight', '500')
      .text(d => d.data.file);

    // Function Name (Body)
    node.append('text')
      .attr('x', 15)
      .attr('y', -cardHeight / 2 + headerHeight + 25)
      .attr('fill', 'var(--panorama-text, #111827)')
      .attr('font-size', '15px')
      .attr('font-weight', '700')
      .text(d => d.data.name);

    // Description (Body)
    node.append('foreignObject')
      .attr('x', 15)
      .attr('y', -cardHeight / 2 + headerHeight + 35)
      .attr('width', cardWidth - 30)
      .attr('height', 40)
      .append('xhtml:div')
      .style('color', 'var(--panorama-muted-text, #6b7280)')
      .style('font-size', '11px')
      .style('overflow', 'hidden')
      .style('display', '-webkit-box')
      .style('-webkit-line-clamp', '2')
      .style('-webkit-box-orient', 'vertical')
      .style('line-height', '1.3')
      .text(d => d.data.description);

    // Drill down indicator (small dot in corner)
    node.append('circle')
      .attr('cx', cardWidth - 15)
      .attr('cy', -cardHeight / 2 + 15)
      .attr('r', 4)
      .attr('fill', d => {
        if (d.data.drillDown === 1) return '#3b82f6';
        if (d.data.drillDown === -1) return '#ef4444';
        return '#eab308';
      });

    // Initial center
    const initialTransform = d3.zoomIdentity
      .translate(width / 4, 100)
      .scale(0.8);
    svg.call(zoom.transform, initialTransform);

  }, [data, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-background overflow-hidden border-l border-border">
      <style>
        {`
          :root {
            --panorama-link: #d1d5db;
            --panorama-node-bg: #ffffff;
            --panorama-node-border: #d1d5db;
            --panorama-text: #111827;
            --panorama-muted-text: #4b5563;
          }
          .dark {
            --panorama-link: #333333;
            --panorama-node-bg: #1a1a1a;
            --panorama-node-border: #333333;
            --panorama-text: #ffffff;
            --panorama-muted-text: #999999;
          }
        `}
      </style>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-background/60 backdrop-blur-md border border-border rounded-full text-[10px] text-muted-foreground">
        <Move size={12} />
        <span>全景图：支持拖拽与缩放</span>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
