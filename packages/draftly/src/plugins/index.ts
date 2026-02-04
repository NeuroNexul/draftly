// Re-export individual plugins
export { HeadingPlugin } from "./heading-plugin";
export { InlinePlugin } from "./inline-plugin";
export { ListPlugin } from "./list-plugin";
export { HTMLPlugin } from "./html-plugin";
export { ImagePlugin } from "./image-plugin";

// Plugin collections
import { DraftlyPlugin } from "../editor/plugin";
import { HeadingPlugin } from "./heading-plugin";
import { InlinePlugin } from "./inline-plugin";
import { ListPlugin } from "./list-plugin";
import { HTMLPlugin } from "./html-plugin";
import { ImagePlugin } from "./image-plugin";

/**
 * Default plugins
 *
 * This is the set of essential plugins
 */
const essentialPlugins: DraftlyPlugin[] = [
  new HeadingPlugin(),
  new InlinePlugin(),
  new ListPlugin(),
  new HTMLPlugin(),
  new ImagePlugin(),
];

/**
 * All plugins
 *
 * This is the set of all plugins available with draftly
 */
const allPlugins: DraftlyPlugin[] = [...essentialPlugins];

export { essentialPlugins, allPlugins };
