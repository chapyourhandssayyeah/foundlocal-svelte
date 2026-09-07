<script>
	import BlogPostLayout from '$lib/components/marketing/BlogPostLayout.svelte';
	import { blogPostBySlug } from '$lib/content/blog-posts';

	const post = blogPostBySlug['aeo-vs-seo-vs-geo-for-geolocally'];
</script>

<BlogPostLayout {post}>
	{@html post.bodyHtml}
</BlogPostLayout>
