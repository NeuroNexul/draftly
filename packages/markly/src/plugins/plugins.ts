import { MarklyPlugin } from "../plugin";
import { HeadingPlugin } from "./heading-plugin";

const defaultPlugins: MarklyPlugin[] = [new HeadingPlugin()];

export { defaultPlugins };
