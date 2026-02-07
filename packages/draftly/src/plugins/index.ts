// Re-export individual plugins
export { ParagraphPlugin } from "./paragraph-plugin";
export { HeadingPlugin } from "./heading-plugin";
export { InlinePlugin } from "./inline-plugin";
export { LinkPlugin } from "./link-plugin";
export { ListPlugin } from "./list-plugin";
export { HTMLPlugin } from "./html-plugin";
export { ImagePlugin } from "./image-plugin";
export { MathPlugin } from "./math-plugin";
export { CodePlugin } from "./code-plugin";

// Plugin collections
import { DraftlyPlugin } from "../editor/plugin";
import { ParagraphPlugin } from "./paragraph-plugin";
import { HeadingPlugin } from "./heading-plugin";
import { InlinePlugin } from "./inline-plugin";
import { LinkPlugin } from "./link-plugin";
import { ListPlugin } from "./list-plugin";
import { HTMLPlugin } from "./html-plugin";
import { ImagePlugin } from "./image-plugin";
import { MathPlugin } from "./math-plugin";
import { CodePlugin } from "./code-plugin";

/**
 * Default plugins
 *
 * This is the set of essential plugins
 */
const essentialPlugins: DraftlyPlugin[] = [
  new ParagraphPlugin(),
  new HeadingPlugin(),
  new InlinePlugin(),
  new LinkPlugin(),
  new ListPlugin(),
  new HTMLPlugin(),
  new ImagePlugin(),
  new MathPlugin(),
  new CodePlugin(),
];

/**
 * All plugins
 *
 * This is the set of all plugins available with draftly
 */
const allPlugins: DraftlyPlugin[] = [...essentialPlugins];

export { essentialPlugins, allPlugins };
