import { MarklyPlugin } from "../plugin";
import { HeadingPlugin } from "./heading-plugin";
import { InlinePlugin } from "./inline-plugin";

const defaultPlugins: MarklyPlugin[] = [new HeadingPlugin(), new InlinePlugin()];

export { defaultPlugins };
