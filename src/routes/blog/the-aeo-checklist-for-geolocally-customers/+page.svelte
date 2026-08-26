<script>
	import BlogPostLayout from '$lib/components/marketing/BlogPostLayout.svelte';
	import { blogPostBySlug } from '$lib/content/blog-posts';

	const post = blogPostBySlug['the-aeo-checklist-for-geolocally-customers'];
</script>

<BlogPostLayout {post}>
	{@html post.bodyHtml}
</BlogPostLayout>
